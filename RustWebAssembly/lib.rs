//! 音频处理WebAssembly模块
//! 
//! 提供高性能音频处理功能，包括波形生成、
//! 均衡器、压缩器和音量标准化等。

use wasm_bindgen::prelude::*;
use web_sys::console;

#[macro_use]
extern crate serde_derive;

/// 打印调试信息到浏览器控制台
macro_rules! log {
    ( $( $t:tt )* ) => {
        web_sys::console::log_1(&format!( $( $t )* ).into());
    }
}

/// 均衡器滤波器类型
#[derive(Serialize, Deserialize)]
pub enum FilterType {
    LowPass,
    BandPass,
    HighPass
}

/// 均衡器滤波器配置
#[wasm_bindgen]
#[derive(Serialize, Deserialize)]
pub struct FilterConfig {
    pub filter_type: u8, // 0 = LowPass, 1 = BandPass, 2 = HighPass
    pub frequency: f32,
    pub q: f32,
    pub gain: f32,
}

#[wasm_bindgen]
impl FilterConfig {
    #[wasm_bindgen(constructor)]
    pub fn new(filter_type: u8, frequency: f32, q: f32, gain: f32) -> FilterConfig {
        FilterConfig {
            filter_type,
            frequency,
            q,
            gain
        }
    }
}

/// 双二阶滤波器实现
struct BiquadFilter {
    sample_rate: f32,
    filter_type: u8,
    frequency: f32,
    q: f32,
    gain: f32,
    
    // 滤波器系数
    a0: f32,
    a1: f32,
    a2: f32,
    b1: f32,
    b2: f32,
    
    // 状态变量
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
}

impl BiquadFilter {
    fn new(sample_rate: f32, config: &FilterConfig) -> BiquadFilter {
        let mut filter = BiquadFilter {
            sample_rate,
            filter_type: config.filter_type,
            frequency: config.frequency,
            q: config.q,
            gain: config.gain,
            a0: 0.0,
            a1: 0.0,
            a2: 0.0,
            b1: 0.0,
            b2: 0.0,
            x1: 0.0,
            x2: 0.0,
            y1: 0.0,
            y2: 0.0,
        };
        
        filter.calculate_coefficients();
        filter
    }
    
    fn calculate_coefficients(&mut self) {
        let omega = 2.0 * std::f32::consts::PI * self.frequency / self.sample_rate;
        let alpha = omega.sin() / (2.0 * self.q);
        let cos_omega = omega.cos();
        
        match self.filter_type {
            // 低通滤波器
            0 => {
                let norm = 1.0 + alpha;
                self.a0 = (1.0 - cos_omega) / 2.0 / norm;
                self.a1 = (1.0 - cos_omega) / norm;
                self.a2 = (1.0 - cos_omega) / 2.0 / norm;
                self.b1 = -2.0 * cos_omega / norm;
                self.b2 = (1.0 - alpha) / norm;
            },
            // 带通滤波器
            1 => {
                let norm = 1.0 + alpha;
                self.a0 = alpha * self.gain / norm;
                self.a1 = 0.0 / norm;
                self.a2 = -alpha * self.gain / norm;
                self.b1 = -2.0 * cos_omega / norm;
                self.b2 = (1.0 - alpha) / norm;
            },
            // 高通滤波器
            2 => {
                let norm = 1.0 + alpha;
                self.a0 = (1.0 + cos_omega) / 2.0 / norm;
                self.a1 = -(1.0 + cos_omega) / norm;
                self.a2 = (1.0 + cos_omega) / 2.0 / norm;
                self.b1 = -2.0 * cos_omega / norm;
                self.b2 = (1.0 - alpha) / norm;
            },
            // 默认为低通
            _ => {
                let norm = 1.0 + alpha;
                self.a0 = (1.0 - cos_omega) / 2.0 / norm;
                self.a1 = (1.0 - cos_omega) / norm;
                self.a2 = (1.0 - cos_omega) / 2.0 / norm;
                self.b1 = -2.0 * cos_omega / norm;
                self.b2 = (1.0 - alpha) / norm;
            }
        }
    }
    
    fn process(&mut self, input: f32) -> f32 {
        // 直接型II转置结构实现
        let output = self.a0 * input + self.x1;
        self.x1 = self.a1 * input - self.b1 * output + self.x2;
        self.x2 = self.a2 * input - self.b2 * output;
        output
    }
    
    fn reset(&mut self) {
        self.x1 = 0.0;
        self.x2 = 0.0;
        self.y1 = 0.0;
        self.y2 = 0.0;
    }
    
    fn set_parameters(&mut self, config: &FilterConfig) {
        self.filter_type = config.filter_type;
        self.frequency = config.frequency;
        self.q = config.q;
        self.gain = config.gain;
        self.calculate_coefficients();
    }
}

/// 音频处理器主类
#[wasm_bindgen]
pub struct AudioProcessor {
    sample_rate: f32,
    channels: u32,
    low_filter: Option<BiquadFilter>,
    mid_filter: Option<BiquadFilter>,
    high_filter: Option<BiquadFilter>,
}

#[wasm_bindgen]
impl AudioProcessor {
    /// 创建新的处理器实例
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32, channels: u32) -> AudioProcessor {
        console::log_1(&"AudioProcessor initialized".into());
        
        // 创建三段均衡器滤波器
        let low_config = FilterConfig::new(0, 200.0, 0.7, 1.0);
        let mid_config = FilterConfig::new(1, 1000.0, 0.7, 1.0);
        let high_config = FilterConfig::new(2, 5000.0, 0.7, 1.0);
        
        let low_filter = BiquadFilter::new(sample_rate, &low_config);
        let mid_filter = BiquadFilter::new(sample_rate, &mid_config);
        let high_filter = BiquadFilter::new(sample_rate, &high_config);
        
        AudioProcessor {
            sample_rate,
            channels,
            low_filter: Some(low_filter),
            mid_filter: Some(mid_filter),
            high_filter: Some(high_filter),
        }
    }
    
    /// 应用均衡器处理
    #[wasm_bindgen]
    pub fn apply_equalizer(&mut self, audio_data: &mut [f32], bass: f32, mid: f32, treble: f32) {
        // 更新滤波器增益
        if let Some(filter) = &mut self.low_filter {
            let mut config = FilterConfig::new(0, 200.0, 0.7, bass);
            filter.set_parameters(&config);
        }
        
        if let Some(filter) = &mut self.mid_filter {
            let mut config = FilterConfig::new(1, 1000.0, 0.7, mid);
            filter.set_parameters(&config);
        }
        
        if let Some(filter) = &mut self.high_filter {
            let mut config = FilterConfig::new(2, 5000.0, 0.7, treble);
            filter.set_parameters(&config);
        }
        
        // 处理每个样本
        for i in 0..audio_data.len() {
            let mut sample = audio_data[i];
            
            // 应用低频滤波器
            if let Some(filter) = &mut self.low_filter {
                let low_output = filter.process(sample);
                sample = low_output;
            }
            
            // 应用中频滤波器
            if let Some(filter) = &mut self.mid_filter {
                let mid_output = filter.process(sample);
                sample = mid_output;
            }
            
            // 应用高频滤波器
            if let Some(filter) = &mut self.high_filter {
                let high_output = filter.process(sample);
                sample = high_output;
            }
            
            audio_data[i] = sample;
        }
    }
    
    /// 音量标准化处理
    #[wasm_bindgen]
    pub fn normalize_volume(&self, audio_data: &mut [f32], target_level: f32) -> f32 {
        // 找出最大振幅
        let mut max_amplitude = 0.0f32;
        for sample in audio_data.iter() {
            let abs_sample = sample.abs();
            if abs_sample > max_amplitude {
                max_amplitude = abs_sample;
            }
        }
        
        // 避免除以零
        if max_amplitude < 0.0001 {
            return 1.0;
        }
        
        // 计算增益
        let gain = target_level / max_amplitude;
        
        // 应用增益
        for sample in audio_data.iter_mut() {
            *sample *= gain;
        }
        
        gain
    }
    
    /// 压缩器处理
    #[wasm_bindgen]
    pub fn apply_compressor(&self, audio_data: &mut [f32], threshold: f32, ratio: f32, attack: f32, release: f32) {
        let mut envelope = 0.0f32;
        
        // 压缩器参数转换
        let attack_coef = (-1.0 / (self.sample_rate * attack)).exp();
        let release_coef = (-1.0 / (self.sample_rate * release)).exp();
        
        // 应用压缩
        for i in 0..audio_data.len() {
            let input = audio_data[i];
            let input_abs = input.abs();
            
            // 包络跟踪
            if envelope < input_abs {
                envelope = input_abs + attack_coef * (envelope - input_abs);
            } else {
                envelope = input_abs + release_coef * (envelope - input_abs);
            }
            
            // 压缩增益计算
            let gain = if envelope > threshold {
                let excess_db = 20.0 * (envelope / threshold).log10();
                let attenuation_db = excess_db * (1.0 - 1.0 / ratio);
                10.0f32.powf(-attenuation_db / 20.0)
            } else {
                1.0
            };
            
            // 应用增益
            audio_data[i] *= gain;
        }
    }
    
    /// 生成波形数据用于可视化
    #[wasm_bindgen]
    pub fn generate_waveform_data(&self, audio_data: &[f32], num_points: u32) -> Box<[f32]> {
        let length = audio_data.len();
        let samples_per_point = length / num_points as usize;
        let mut waveform = Vec::with_capacity(num_points as usize);
        
        // 确保每点至少有一个样本
        if samples_per_point == 0 {
            return vec![0.0; num_points as usize].into_boxed_slice();
        }
        
        for i in 0..num_points as usize {
            let start = i * samples_per_point;
            let end = std::cmp::min(start + samples_per_point, length);
            
            // 计算RMS值
            let mut sum_squared = 0.0;
            for j in start..end {
                sum_squared += audio_data[j] * audio_data[j];
            }
            
            let rms = if end > start {
                (sum_squared / (end - start) as f32).sqrt()
            } else {
                0.0
            };
            
            waveform.push(rms);
        }
        
        // 正规化波形数据到0-1范围
        let max_value = waveform.iter().fold(0.0f32, |a, &b| a.max(b));
        if max_value > 0.0 {
            for value in &mut waveform {
                *value /= max_value;
            }
        }
        
        waveform.into_boxed_slice()
    }
    
    /// AB循环处理 - 确定循环点的样本索引
    #[wasm_bindgen]
    pub fn calculate_loop_points(&self, total_samples: u32, start_percent: f32, end_percent: f32) -> Box<[u32]> {
        let start_sample = (total_samples as f32 * start_percent / 100.0) as u32;
        let end_sample = (total_samples as f32 * end_percent / 100.0) as u32;
        vec![start_sample, end_sample].into_boxed_slice()
    }
}

// JavaScript辅助函数
#[wasm_bindgen]
pub fn wasm_memory_buffer_supported() -> bool {
    true
}

// 初始化函数
#[wasm_bindgen(start)]
pub fn start() {
    // 设置恐慌钩子
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
    console::log_1(&"WebAssembly音频处理模块已初始化".into());
}