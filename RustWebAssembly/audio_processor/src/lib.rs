use fundsp::hacker::*;
use pitch_detection::detector::mcleod::McLeodDetector;
use pitch_detection::detector::PitchDetector;
use realfft::RealFftPlanner;
use serde::{Deserialize, Serialize};
use std::f32;
use wasm_bindgen::prelude::*;
use web_sys::{console, AudioBuffer};

// 初始化 panic hook
fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// 音频特征结构
#[derive(Serialize, Deserialize)]
pub struct AudioFeatures {
    pub rms: f32,
    pub peak: f32,
    pub pitch: Option<f32>,
    pub spectral_centroid: f32,
    pub zero_crossing_rate: f32,
}

// 均衡器设置
#[derive(Serialize, Deserialize)]
pub struct EqualizerSettings {
    pub bass: f32,
    pub mid: f32,
    pub treble: f32,
}

// 压缩器设置
#[derive(Serialize, Deserialize)]
pub struct CompressorSettings {
    pub threshold: f32,
    pub ratio: f32,
    pub attack: f32,
    pub release: f32,
    pub makeup_gain: f32,
}

// AudioProcessor 主处理器类
#[wasm_bindgen]
pub struct AudioProcessor {
    sample_rate: usize,
}

#[wasm_bindgen]
impl AudioProcessor {
    // 构造函数
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        init_panic_hook();
        
        AudioProcessor {
            sample_rate: 44100,
        }
    }
    
    // 设置采样率
    #[wasm_bindgen]
    pub fn set_sample_rate(&mut self, sample_rate: usize) {
        self.sample_rate = sample_rate;
    }
    
    // 生成波形数据
    #[wasm_bindgen]
    pub fn generate_waveform(&self, audio_data: &[f32], num_points: u32) -> Box<[f32]> {
        let num_points = num_points as usize;
        let mut result = vec![0.0; num_points];
        
        if audio_data.is_empty() {
            return result.into_boxed_slice();
        }
        
        // 每个波形点代表的样本数
        let samples_per_point = audio_data.len() / num_points;
        if samples_per_point < 1 {
            // 数据点太少，需要插值
            for i in 0..num_points {
                let idx = (i as f32 * audio_data.len() as f32 / num_points as f32) as usize;
                result[i] = audio_data[idx.min(audio_data.len() - 1)].abs();
            }
        } else {
            // 对每个点找出代表区间的最大振幅
            for i in 0..num_points {
                let start = i * samples_per_point;
                let end = (i + 1) * samples_per_point;
                let end = end.min(audio_data.len());
                
                let mut max_amp = 0.0;
                for j in start..end {
                    let amp = audio_data[j].abs();
                    if amp > max_amp {
                        max_amp = amp;
                    }
                }
                
                result[i] = max_amp;
            }
        }
        
        result.into_boxed_slice()
    }
    
    // 应用均衡器
    #[wasm_bindgen]
    pub fn apply_equalizer(&self, audio_data: &mut [f32], settings: JsValue) -> Result<(), JsValue> {
        let settings: EqualizerSettings = serde_wasm_bindgen::from_value(settings)?;
        
        // 仅当有需要时才处理
        if (settings.bass - 1.0).abs() < 0.01 && 
           (settings.mid - 1.0).abs() < 0.01 && 
           (settings.treble - 1.0).abs() < 0.01 {
            return Ok(());
        }
        
        // 使用 fundsp 库构建三段均衡器
        let eq = 
            pass() // 直通
            | (settings.bass * lp_butterworth::<f64>(2, 200.0 / 44100.0)) // 低通滤波器
            | (settings.mid * bp_butterworth::<f64>(2, 1000.0 / 44100.0, 2.0)) // 带通滤波器
            | (settings.treble * hp_butterworth::<f64>(2, 4000.0 / 44100.0)); // 高通滤波器
        
        // 设置初始状态
        let mut eq = eq.reset();
        
        // 处理音频
        for sample in audio_data.iter_mut() {
            let input = *sample as f64;
            let output = eq.process(input);
            *sample = output as f32;
        }
        
        Ok(())
    }
    
    // 应用音频压缩
    #[wasm_bindgen]
    pub fn apply_compression(&self, audio_data: &mut [f32], settings: JsValue) -> Result<(), JsValue> {
        let settings: CompressorSettings = serde_wasm_bindgen::from_value(settings)?;
        
        // 压缩时间常数
        let attack_coef = (-1.0 / (settings.attack * self.sample_rate as f32)).exp();
        let release_coef = (-1.0 / (settings.release * self.sample_rate as f32)).exp();
        
        // 压缩状态
        let mut envelope = 0.0;
        
        // 处理每个样本
        for sample in audio_data.iter_mut() {
            // 计算当前样本电平
            let input_level = sample.abs();
            
            // 包络跟踪
            if input_level > envelope {
                envelope = attack_coef * (envelope - input_level) + input_level; // 攻击
            } else {
                envelope = release_coef * (envelope - input_level) + input_level; // 释放
            }
            
            // 计算增益缩减 (dB)
            let mut gain_reduction = 0.0;
            if envelope > settings.threshold {
                // 如果超过阈值，计算增益缩减（单位：dB）
                let slope = 1.0 - 1.0 / settings.ratio;
                gain_reduction = slope * (envelope.log10() * 20.0 - settings.threshold);
            }
            
            // 将增益缩减从dB转换为线性
            let gain = 10.0f32.powf(-gain_reduction / 20.0) * 10.0f32.powf(settings.makeup_gain / 20.0);
            
            // 应用增益
            *sample *= gain;
        }
        
        Ok(())
    }
    
    // 音频降噪
    #[wasm_bindgen]
    pub fn denoise_audio(&self, audio_data: &mut [f32], noise_threshold: f32) -> Result<(), JsValue> {
        let sample_rate = self.sample_rate;
        let fft_size = 2048; // FFT大小
        let hop_size = fft_size / 4; // 帧移
        
        // 检查音频长度是否足够
        if audio_data.len() < fft_size {
            return Err(JsValue::from_str("音频太短，无法进行降噪处理"));
        }
        
        // 创建FFT计划
        let mut planner = RealFftPlanner::<f32>::new();
        let r2c = planner.plan_fft_forward(fft_size);
        let c2r = planner.plan_fft_inverse(fft_size);
        
        // 分配FFT缓冲区
        let mut buffer = vec![0.0; fft_size];
        let mut spectrum = r2c.make_output_vec();
        let mut output_buffer = vec![0.0; fft_size];
        
        // 汉宁窗函数
        let window: Vec<f32> = (0..fft_size)
            .map(|i| 0.5 * (1.0 - (2.0 * std::f32::consts::PI * i as f32 / (fft_size as f32 - 1.0)).cos()))
            .collect();
        
        // 处理每一帧
        let mut processed_audio = vec![0.0; audio_data.len()];
        for i in (0..audio_data.len().saturating_sub(fft_size)).step_by(hop_size) {
            // 复制并加窗
            for j in 0..fft_size {
                if i + j < audio_data.len() {
                    buffer[j] = audio_data[i + j] * window[j];
                } else {
                    buffer[j] = 0.0;
                }
            }
            
            // 执行FFT
            r2c.process(&mut buffer, &mut spectrum).expect("FFT处理失败");
            
            // 频谱减法降噪
            for k in 0..spectrum.len() {
                // 计算频谱幅度
                let re = spectrum[k].re;
                let im = spectrum[k].im;
                let magnitude = (re * re + im * im).sqrt();
                
                // 应用噪声阈值（频谱减法）
                let new_magnitude = if magnitude > noise_threshold {
                    magnitude - noise_threshold
                } else {
                    0.0
                };
                
                // 重建频谱
                if magnitude > 1e-10 {
                    let scale = new_magnitude / magnitude;
                    spectrum[k].re *= scale;
                    spectrum[k].im *= scale;
                } else {
                    spectrum[k].re = 0.0;
                    spectrum[k].im = 0.0;
                }
            }
            
            // 执行IFFT
            c2r.process(&mut spectrum, &mut output_buffer).expect("IFFT处理失败");
            
            // 叠加到输出
            for j in 0..fft_size {
                if i + j < processed_audio.len() {
                    processed_audio[i + j] += output_buffer[j] * window[j] / (fft_size as f32 * 1.5);
                }
            }
        }
        
        // 复制回原缓冲区
        for i in 0..audio_data.len() {
            audio_data[i] = processed_audio[i];
        }
        
        Ok(())
    }
    
    // 音频特征提取
    #[wasm_bindgen]
    pub fn analyze_audio(&self, audio_data: &[f32]) -> Result<JsValue, JsValue> {
        // 计算RMS
        let rms = self.calculate_rms(audio_data);
        
        // 计算峰值
        let peak = self.calculate_peak(audio_data);
        
        // 计算基频（音高）
        let pitch = self.detect_pitch(audio_data);
        
        // 计算频谱质心
        let spectral_centroid = self.calculate_spectral_centroid(audio_data);
        
        // 计算过零率
        let zero_crossing_rate = self.calculate_zero_crossing_rate(audio_data);
        
        // 创建特征结构
        let features = AudioFeatures {
            rms,
            peak,
            pitch,
            spectral_centroid,
            zero_crossing_rate,
        };
        
        // 转换为JS对象
        Ok(serde_wasm_bindgen::to_value(&features)?)
    }
    
    // 计算RMS (Root Mean Square) 均方根振幅
    fn calculate_rms(&self, audio_data: &[f32]) -> f32 {
        if audio_data.is_empty() {
            return 0.0;
        }
        
        let sum_squares: f32 = audio_data.iter().map(|x| x * x).sum();
        (sum_squares / audio_data.len() as f32).sqrt()
    }
    
    // 计算峰值振幅
    fn calculate_peak(&self, audio_data: &[f32]) -> f32 {
        if audio_data.is_empty() {
            return 0.0;
        }
        
        audio_data.iter().map(|x| x.abs()).fold(0.0, f32::max)
    }
    
    // 检测基频（音高）
    fn detect_pitch(&self, audio_data: &[f32]) -> Option<f32> {
        if audio_data.len() < 1024 {
            return None;
        }
        
        // 使用McLeod音高检测算法
        let mut detector = McLeodDetector::new(1024, 512);
        
        // 准备输入数据（使用数据的中段以避免边缘效应）
        let start = audio_data.len().saturating_sub(1024) / 2;
        let buffer: Vec<f32> = audio_data.iter().skip(start).take(1024).cloned().collect();
        
        // 检测音高
        let pitch_result = detector.get_pitch(&buffer, self.sample_rate as usize, 0.2, 0.7);
        
        // 返回检测结果
        pitch_result.map(|p| p.frequency)
    }
    
    // 计算频谱质心
    fn calculate_spectral_centroid(&self, audio_data: &[f32]) -> f32 {
        if audio_data.len() < 1024 {
            return 0.0;
        }
        
        // 创建FFT计划
        let mut planner = RealFftPlanner::<f32>::new();
        let r2c = planner.plan_fft_forward(1024);
        
        // 准备输入数据
        let start = audio_data.len().saturating_sub(1024) / 2;
        let mut buffer: Vec<f32> = audio_data.iter().skip(start).take(1024).cloned().collect();
        
        // 应用窗函数
        for i in 0..buffer.len() {
            let window = 0.5 * (1.0 - (2.0 * std::f32::consts::PI * i as f32 / (buffer.len() as f32 - 1.0)).cos());
            buffer[i] *= window;
        }
        
        // 执行FFT
        let mut spectrum = r2c.make_output_vec();
        r2c.process(&mut buffer, &mut spectrum).expect("FFT处理失败");
        
        // 计算频谱质心
        let mut weighted_sum = 0.0;
        let mut sum = 0.0;
        
        for (i, bin) in spectrum.iter().enumerate() {
            let magnitude = (bin.re * bin.re + bin.im * bin.im).sqrt();
            weighted_sum += i as f32 * magnitude;
            sum += magnitude;
        }
        
        if sum > 0.0 {
            weighted_sum / sum
        } else {
            0.0
        }
    }
    
    // 计算过零率
    fn calculate_zero_crossing_rate(&self, audio_data: &[f32]) -> f32 {
        if audio_data.len() <= 1 {
            return 0.0;
        }
        
        let mut count = 0;
        
        for i in 1..audio_data.len() {
            if (audio_data[i] >= 0.0 && audio_data[i-1] < 0.0) || 
               (audio_data[i] < 0.0 && audio_data[i-1] >= 0.0) {
                count += 1;
            }
        }
        
        count as f32 / (audio_data.len() as f32 - 1.0)
    }
}

// 工具函数：从 AudioBuffer 提取单声道数据
#[wasm_bindgen]
pub fn extract_mono_from_buffer(buffer: &AudioBuffer) -> Box<[f32]> {
    let length = buffer.get_channel_data(0).unwrap().length() as usize;
    let mut mono_data = vec![0.0; length];
    
    // 获取第一个通道数据
    let channel_data = buffer.get_channel_data(0).unwrap();
    
    // 复制数据
    for i in 0..length {
        mono_data[i] = channel_data.get_index(i as u32);
    }
    
    // 如果有多个通道，计算平均值
    let num_channels = buffer.number_of_channels();
    if num_channels > 1 {
        for channel in 1..num_channels {
            let channel_data = buffer.get_channel_data(channel as u32).unwrap();
            for i in 0..length {
                mono_data[i] += channel_data.get_index(i as u32);
            }
        }
        
        // 计算平均值
        for sample in &mut mono_data {
            *sample /= num_channels as f32;
        }
    }
    
    mono_data.into_boxed_slice()
}

// 初始化函数
#[wasm_bindgen]
pub fn init() {
    init_panic_hook();
    console::log_1(&"Audio Processor WASM module initialized".into());
} 