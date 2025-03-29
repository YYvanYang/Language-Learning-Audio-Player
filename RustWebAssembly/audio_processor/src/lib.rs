// 移除未使用的导入
use pitch_detection::detector::mcleod::McLeodDetector;
use pitch_detection::detector::PitchDetector;
use realfft::RealFftPlanner;
use serde::{Deserialize, Serialize};
use std::f32;
use wasm_bindgen::prelude::*;
use web_sys::{console, AudioBuffer};

// 初始化 panic hook
fn init_panic_hook() {
    // 直接调用，无需条件编译
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

// 频谱分析结果
#[derive(Serialize, Deserialize)]
pub struct SpectrumAnalysisResult {
    pub magnitudes: Vec<f32>,
    pub phases: Vec<f32>,
    pub frequencies: Vec<f32>,
    pub dominant_frequency: f32,
    pub spectral_flux: f32,
}

// 实时处理状态
#[derive(Serialize, Deserialize)]
pub struct RealTimeProcessorState {
    pub envelope: f32,
    pub pitch_history: Vec<f32>,
    pub spectral_flux_history: Vec<f32>,
    pub rms_history: Vec<f32>,
}

// AudioProcessor 主处理器类
#[wasm_bindgen]
pub struct AudioProcessor {
    sample_rate: usize,
    fft_planner: Option<RealFftPlanner<f32>>,
    envelope: f32,
    pitch_history: Vec<f32>,
    spectral_flux_history: Vec<f32>,
    rms_history: Vec<f32>,
    prev_spectrum: Option<Vec<f32>>,
}

#[wasm_bindgen]
impl AudioProcessor {
    // 构造函数
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        init_panic_hook();
        
        AudioProcessor {
            sample_rate: 44100,
            fft_planner: Some(RealFftPlanner::new()),
            envelope: 0.0,
            pitch_history: vec![0.0; 10],
            spectral_flux_history: vec![0.0; 30],
            rms_history: vec![0.0; 30],
            prev_spectrum: None,
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
                result[i] = audio_data[std::cmp::min(idx, audio_data.len() - 1)].abs();
            }
        } else {
            // 对每个点找出代表区间的最大振幅
            for i in 0..num_points {
                let start = i * samples_per_point;
                let end = (i + 1) * samples_per_point;
                let end = std::cmp::min(end, audio_data.len());
                
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
        let settings: EqualizerSettings = serde_wasm_bindgen::from_value(settings.clone())?;
        
        // 仅当有需要时才处理
        if (settings.bass - 1.0).abs() < 0.01 && 
           (settings.mid - 1.0).abs() < 0.01 && 
           (settings.treble - 1.0).abs() < 0.01 {
            return Ok(());
        }
        
        // 创建三段式均衡器
        let mut bass_filter = IIRFilter::low_pass(200.0 / self.sample_rate as f32, 0.707);
        let mut mid_filter = IIRFilter::peak(1000.0 / self.sample_rate as f32, 1.0, 
                                          (settings.mid - 1.0) * 12.0); // 将线性增益转换为dB增益
        let mut treble_filter = IIRFilter::high_pass(4000.0 / self.sample_rate as f32, 0.707);
        
        // 计算增益系数
        let bass_gain = settings.bass;
        let treble_gain = settings.treble;
        
        // 处理音频
        let mut filtered_audio = vec![0.0; audio_data.len()];
        
        // 低频处理
        for i in 0..audio_data.len() {
            let bass = bass_filter.process(audio_data[i]) * bass_gain;
            filtered_audio[i] += bass;
        }
        
        // 中频处理 - 直接通过峰值滤波器
        for i in 0..audio_data.len() {
            filtered_audio[i] += mid_filter.process(audio_data[i]);
        }
        
        // 高频处理
        for i in 0..audio_data.len() {
            let treble = treble_filter.process(audio_data[i]) * treble_gain;
            filtered_audio[i] += treble;
        }
        
        // 将处理后的音频写回原始缓冲区
        for i in 0..audio_data.len() {
            audio_data[i] = filtered_audio[i] / 3.0; // 均衡三段信号电平
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
        // 移除未使用变量警告
        let _sample_rate = self.sample_rate;
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

    // 实时处理一帧音频数据
    #[wasm_bindgen]
    pub fn process_audio_frame(&mut self, audio_frame: &mut [f32], settings: JsValue) -> Result<JsValue, JsValue> {
        // 克隆settings避免移动
        let settings_clone = settings.clone();
        
        // 应用均衡器处理
        self.apply_equalizer(audio_frame, settings_clone)?;
        
        // 更新包络跟踪器（用于音量监测）
        let current_rms = self.calculate_rms(audio_frame);
        self.envelope = 0.9 * self.envelope + 0.1 * current_rms;
        
        // 更新RMS历史
        self.rms_history.remove(0);
        self.rms_history.push(current_rms);
        
        // 检测音高并更新历史
        if let Some(pitch) = self.detect_pitch(audio_frame) {
            self.pitch_history.remove(0);
            self.pitch_history.push(pitch);
        }
        
        // 计算频谱并更新频谱变化历史
        if let Ok(spectrum_data) = self.analyze_spectrum_data(audio_frame) {
            if let Ok(spectrum_result) = serde_wasm_bindgen::from_value::<SpectrumAnalysisResult>(spectrum_data) {
                self.spectral_flux_history.remove(0);
                self.spectral_flux_history.push(spectrum_result.spectral_flux);
            }
        }
        
        // 创建返回状态
        let state = RealTimeProcessorState {
            envelope: self.envelope,
            pitch_history: self.pitch_history.clone(),
            spectral_flux_history: self.spectral_flux_history.clone(),
            rms_history: self.rms_history.clone(),
        };
        
        Ok(serde_wasm_bindgen::to_value(&state)?)
    }
    
    // 频谱分析
    // 计算频谱分析结果，但不暴露给WebAssembly
    fn analyze_spectrum_internal(&mut self, audio_data: &[f32]) -> Option<SpectrumAnalysisResult> {
        if audio_data.len() < 512 {
            return None;
        }
        
        let fft_size = 1024;
        let sample_rate = self.sample_rate;
        
        // 提取分析窗口
        let mut analysis_window = Vec::with_capacity(fft_size);
        let start_idx = audio_data.len().saturating_sub(fft_size);
        
        // 复制数据并应用汉宁窗
        for i in 0..fft_size {
            if start_idx + i < audio_data.len() {
                let window_val = 0.5 * (1.0 - (2.0 * std::f32::consts::PI * i as f32 / (fft_size - 1) as f32).cos());
                analysis_window.push(audio_data[start_idx + i] * window_val);
            } else {
                analysis_window.push(0.0);
            }
        }
        
        // 执行FFT
        let planner = self.fft_planner.as_mut()?;
        let r2c = planner.plan_fft_forward(fft_size);
        let mut buffer = analysis_window;
        let mut spectrum = r2c.make_output_vec();
        
        if let Err(_) = r2c.process(&mut buffer, &mut spectrum) {
            return None;
        }
        
        // 计算幅度和相位
        let mut magnitudes = vec![0.0; spectrum.len()];
        let mut phases = vec![0.0; spectrum.len()];
        let mut max_magnitude = 0.0;
        let mut max_magnitude_idx = 0;
        
        for (i, bin) in spectrum.iter().enumerate() {
            let magnitude = (bin.re * bin.re + bin.im * bin.im).sqrt();
            let phase = bin.im.atan2(bin.re);
            
            magnitudes[i] = magnitude;
            phases[i] = phase;
            
            if magnitude > max_magnitude {
                max_magnitude = magnitude;
                max_magnitude_idx = i;
            }
        }
        
        // 计算频率
        let frequencies = (0..spectrum.len())
            .map(|i| i as f32 * sample_rate as f32 / fft_size as f32)
            .collect::<Vec<f32>>();
        
        let dominant_frequency = max_magnitude_idx as f32 * sample_rate as f32 / fft_size as f32;
        
        // 计算频谱变化（与上一帧相比）
        let spectral_flux = match &self.prev_spectrum {
            Some(prev) => {
                // 限制到最小长度
                let min_len = std::cmp::min(prev.len(), magnitudes.len());
                
                // 计算频谱变化
                let mut flux = 0.0;
                for i in 0..min_len {
                    let diff = magnitudes[i] - prev[i];
                    // 只考虑增长的部分（HFC - High Frequency Content）
                    flux += if diff > 0.0 { diff } else { 0.0 };
                }
                
                flux
            },
            None => 0.0,
        };
        
        // 更新先前频谱
        self.prev_spectrum = Some(magnitudes.clone());
        
        Some(SpectrumAnalysisResult {
            magnitudes,
            phases,
            frequencies,
            dominant_frequency,
            spectral_flux,
        })
    }
    
    // 公开的WebAssembly接口，返回频谱分析结果
    #[wasm_bindgen]
    pub fn analyze_spectrum_data(&mut self, audio_data: &[f32]) -> Result<JsValue, JsValue> {
        match self.analyze_spectrum_internal(audio_data) {
            Some(result) => Ok(serde_wasm_bindgen::to_value(&result)?),
            None => Err(JsValue::from_str("无法分析频谱数据")),
        }
    }
    
    // 获取当前处理状态
    #[wasm_bindgen]
    pub fn get_processor_state(&self) -> Result<JsValue, JsValue> {
        let state = RealTimeProcessorState {
            envelope: self.envelope,
            pitch_history: self.pitch_history.clone(),
            spectral_flux_history: self.spectral_flux_history.clone(),
            rms_history: self.rms_history.clone(),
        };
        
        Ok(serde_wasm_bindgen::to_value(&state)?)
    }
}

// 工具函数：从 AudioBuffer 提取单声道数据
#[wasm_bindgen]
pub fn extract_mono_from_buffer(buffer: &AudioBuffer) -> Box<[f32]> {
    let length = buffer.get_channel_data(0).unwrap().len() as usize;
    let mut mono_data = vec![0.0; length];
    
    // 获取第一个通道数据
    let channel_data = buffer.get_channel_data(0).unwrap();
    
    // 复制数据
    for i in 0..length {
        mono_data[i] = channel_data[i];
    }
    
    // 如果有多个通道，计算平均值
    let num_channels = buffer.number_of_channels();
    if num_channels > 1 {
        for channel in 1..num_channels {
            let channel_data = buffer.get_channel_data(channel as u32).unwrap();
            for i in 0..length {
                mono_data[i] += channel_data[i];
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

// 添加一个简单的IIR滤波器结构
struct IIRFilter {
    a: [f32; 3], // 分母系数
    b: [f32; 3], // 分子系数
    x: [f32; 3], // 输入历史
    y: [f32; 3], // 输出历史
}

impl IIRFilter {
    // 创建一个低通滤波器
    fn low_pass(cutoff: f32, q: f32) -> Self {
        // 计算滤波器系数
        let omega = 2.0 * std::f32::consts::PI * cutoff;
        let alpha = omega.sin() / (2.0 * q);
        
        let b0 = (1.0 - omega.cos()) / 2.0;
        let b1 = 1.0 - omega.cos();
        let b2 = (1.0 - omega.cos()) / 2.0;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * omega.cos();
        let a2 = 1.0 - alpha;
        
        // 归一化系数
        let b = [b0 / a0, b1 / a0, b2 / a0];
        let a = [1.0, a1 / a0, a2 / a0];
        
        Self {
            a,
            b,
            x: [0.0; 3],
            y: [0.0; 3],
        }
    }
    
    // 创建一个高通滤波器
    fn high_pass(cutoff: f32, q: f32) -> Self {
        // 计算滤波器系数
        let omega = 2.0 * std::f32::consts::PI * cutoff;
        let alpha = omega.sin() / (2.0 * q);
        
        let b0 = (1.0 + omega.cos()) / 2.0;
        let b1 = -(1.0 + omega.cos());
        let b2 = (1.0 + omega.cos()) / 2.0;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * omega.cos();
        let a2 = 1.0 - alpha;
        
        // 归一化系数
        let b = [b0 / a0, b1 / a0, b2 / a0];
        let a = [1.0, a1 / a0, a2 / a0];
        
        Self {
            a,
            b,
            x: [0.0; 3],
            y: [0.0; 3],
        }
    }
    
    // 创建一个峰值滤波器 (band peak)
    fn peak(cutoff: f32, q: f32, gain: f32) -> Self {
        // 计算滤波器系数
        let omega = 2.0 * std::f32::consts::PI * cutoff;
        let alpha = omega.sin() / (2.0 * q);
        let a = 10.0f32.powf(gain / 40.0); // 将dB增益转换为线性增益
        
        let b0 = 1.0 + alpha * a;
        let b1 = -2.0 * omega.cos();
        let b2 = 1.0 - alpha * a;
        let a0 = 1.0 + alpha / a;
        let a1 = -2.0 * omega.cos();
        let a2 = 1.0 - alpha / a;
        
        // 归一化系数
        let b = [b0 / a0, b1 / a0, b2 / a0];
        let a = [1.0, a1 / a0, a2 / a0];
        
        Self {
            a,
            b,
            x: [0.0; 3],
            y: [0.0; 3],
        }
    }
    
    // 处理单个样本
    fn process(&mut self, input: f32) -> f32 {
        // 更新输入历史
        self.x[2] = self.x[1];
        self.x[1] = self.x[0];
        self.x[0] = input;
        
        // 计算输出
        let output = self.b[0] * self.x[0] + 
                     self.b[1] * self.x[1] + 
                     self.b[2] * self.x[2] - 
                     self.a[1] * self.y[0] - 
                     self.a[2] * self.y[1];
        
        // 更新输出历史
        self.y[2] = self.y[1];
        self.y[1] = self.y[0];
        self.y[0] = output;
        
        output
    }
} 