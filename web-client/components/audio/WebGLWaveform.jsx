"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useRealtimeAudioProcessor } from '../../lib/audio/useRealtimeAudioProcessor';

// WebGL着色器
const VERTEX_SHADER = `
  attribute vec2 position;
  uniform float uScaleY;
  uniform float uOffsetY;
  
  void main() {
    // 应用Y轴缩放和偏移
    vec2 scaledPosition = vec2(position.x, position.y * uScaleY + uOffsetY);
    gl_Position = vec4(scaledPosition, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec4 uColor;
  
  void main() {
    gl_FragColor = uColor;
  }
`;

// 主题定义
const THEMES = {
  default: {
    background: [0.05, 0.05, 0.05, 1.0],
    waveform: [0.23, 0.51, 0.96, 1.0],
    playhead: [0.91, 0.17, 0.17, 1.0],
    selection: [0.23, 0.51, 0.96, 0.3]
  },
  dark: {
    background: [0.1, 0.1, 0.1, 1.0],
    waveform: [0.0, 0.8, 0.6, 1.0],
    playhead: [1.0, 0.5, 0.0, 1.0],
    selection: [0.0, 0.8, 0.6, 0.3]
  },
  light: {
    background: [0.95, 0.95, 0.95, 1.0],
    waveform: [0.0, 0.4, 0.7, 1.0],
    playhead: [0.9, 0.2, 0.2, 1.0],
    selection: [0.0, 0.4, 0.7, 0.2]
  }
};

/**
 * WebGL加速的波形可视化组件
 * 
 * @param {Object} props - 组件属性
 * @param {AudioBuffer|Float32Array} props.audioData - 音频数据
 * @param {number} props.currentTime - 当前播放时间
 * @param {number} props.duration - 音频总时长
 * @param {Object} props.loopRegion - AB循环区域 {start, end}
 * @param {Array} props.bookmarks - 书签数组 [{id, time, label}]
 * @param {Function} props.onSeek - 跳转回调
 * @param {Function} props.onSetLoop - 设置循环区域回调
 * @param {string} props.theme - 主题名称 (default, dark, light)
 * @param {AudioContext} props.audioContext - 音频上下文
 */
export default function WebGLWaveform({ 
  audioData,
  currentTime = 0,
  duration = 0,
  loopRegion = null,
  bookmarks = [],
  onSeek = () => {},
  onSetLoop = () => {},
  theme = 'default',
  audioContext = null
}) {
  // 引用和状态
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const bufferRef = useRef(null);
  const waveformDataRef = useRef(null);
  const animationRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoopSelecting, setIsLoopSelecting] = useState(false);
  const [loopStart, setLoopStart] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [lastRenderTime, setLastRenderTime] = useState(0);
  
  // 获取主题颜色
  const themeColors = THEMES[theme] || THEMES.default;
  
  // 实时处理器
  const realtimeProcessor = useRealtimeAudioProcessor({
    audioContext,
    autoInit: !!audioContext,
  });
  
  // 初始化WebGL
  const initWebGL = useCallback(() => {
    if (!canvasRef.current) return false;
    
    try {
      // 获取WebGL上下文
      const gl = canvasRef.current.getContext('webgl') || 
                 canvasRef.current.getContext('experimental-webgl');
                 
      if (!gl) {
        throw new Error('无法初始化WebGL');
      }
      
      glRef.current = gl;
      
      // 创建着色器
      const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      
      // 创建程序
      const program = createProgram(gl, vertexShader, fragmentShader);
      programRef.current = program;
      
      // 创建顶点缓冲区
      const buffer = gl.createBuffer();
      bufferRef.current = buffer;
      
      // 获取属性和统一变量位置
      program.positionAttributeLocation = gl.getAttribLocation(program, 'position');
      program.colorUniformLocation = gl.getUniformLocation(program, 'uColor');
      program.scaleYUniformLocation = gl.getUniformLocation(program, 'uScaleY');
      program.offsetYUniformLocation = gl.getUniformLocation(program, 'uOffsetY');
      
      // 启用属性
      gl.enableVertexAttribArray(program.positionAttributeLocation);
      
      return true;
    } catch (error) {
      console.error('WebGL初始化失败:', error);
      return false;
    }
  }, []);
  
  // 创建着色器
  const createShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('着色器编译失败: ' + error);
    }
    
    return shader;
  };
  
  // 创建程序
  const createProgram = (gl, vertexShader, fragmentShader) => {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error('程序链接失败: ' + error);
    }
    
    return program;
  };
  
  // 处理音频数据生成波形
  const processAudioData = useCallback(async () => {
    if (!audioData) return;
    
    try {
      let waveformData;
      
      if (audioData instanceof Float32Array) {
        // 直接使用Float32Array数据
        const dataPoints = Math.min(2048, audioData.length);
        
        // 使用WebAssembly处理波形（如果有）
        if (realtimeProcessor.isInitialized) {
          const processor = realtimeProcessor.getProcessorNode();
          if (processor) {
            // 请求处理器生成波形
            processor.port.postMessage({
              type: 'generateWaveform',
              buffer: audioData.buffer,
              numPoints: dataPoints
            });
            
            // 消息会通过处理器的消息系统返回
            realtimeProcessor.registerMessageHandler('waveformData', (data) => {
              waveformDataRef.current = new Float32Array(data.buffer);
              requestAnimationFrame(renderFrame);
            });
            
            return;
          }
        }
        
        // 否则使用简单的JavaScript处理
        waveformData = new Float32Array(dataPoints);
        const samplesPerPoint = Math.floor(audioData.length / dataPoints);
        
        for (let i = 0; i < dataPoints; i++) {
          const start = i * samplesPerPoint;
          const end = start + samplesPerPoint;
          
          let max = 0;
          for (let j = start; j < end && j < audioData.length; j++) {
            const abs = Math.abs(audioData[j]);
            if (abs > max) max = abs;
          }
          
          waveformData[i] = max;
        }
      } else if (audioData instanceof AudioBuffer) {
        // 从AudioBuffer提取数据
        const audioChannel = audioData.getChannelData(0);
        const dataPoints = Math.min(2048, audioChannel.length);
        
        // 使用简单的JavaScript处理
        waveformData = new Float32Array(dataPoints);
        const samplesPerPoint = Math.floor(audioChannel.length / dataPoints);
        
        for (let i = 0; i < dataPoints; i++) {
          const start = i * samplesPerPoint;
          const end = start + samplesPerPoint;
          
          let max = 0;
          for (let j = start; j < end && j < audioChannel.length; j++) {
            const abs = Math.abs(audioChannel[j]);
            if (abs > max) max = abs;
          }
          
          waveformData[i] = max;
        }
      } else {
        console.error('不支持的音频数据类型');
        return;
      }
      
      // 保存波形数据并请求渲染
      waveformDataRef.current = waveformData;
      requestAnimationFrame(renderFrame);
    } catch (error) {
      console.error('处理音频数据失败:', error);
    }
  }, [audioData, realtimeProcessor]);
  
  // 渲染一帧
  const renderFrame = useCallback(() => {
    if (!glRef.current || !programRef.current || !bufferRef.current || !waveformDataRef.current) {
      return;
    }
    
    const gl = glRef.current;
    const program = programRef.current;
    const buffer = bufferRef.current;
    const waveformData = waveformDataRef.current;
    const { width, height } = canvasSize;
    
    // 设置视口和清除
    gl.viewport(0, 0, width, height);
    gl.clearColor(...themeColors.background);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // 使用程序
    gl.useProgram(program);
    
    // 准备顶点数据
    const vertices = createWaveformVertices(waveformData, width, height);
    
    // 绑定并填充缓冲区
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(program.positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
    
    // 设置统一变量
    gl.uniform4fv(program.colorUniformLocation, themeColors.waveform);
    gl.uniform1f(program.scaleYUniformLocation, 0.5);
    gl.uniform1f(program.offsetYUniformLocation, 0.0);
    
    // 绘制波形
    gl.drawArrays(gl.LINE_STRIP, 0, waveformData.length);
    
    // 绘制播放头
    if (duration > 0) {
      const playheadPos = (currentTime / duration) * 2 - 1;
      const playheadVertices = new Float32Array([
        playheadPos, -1.0,
        playheadPos, 1.0
      ]);
      
      gl.bufferData(gl.ARRAY_BUFFER, playheadVertices, gl.STATIC_DRAW);
      gl.uniform4fv(program.colorUniformLocation, themeColors.playhead);
      gl.drawArrays(gl.LINES, 0, 2);
    }
    
    // 绘制循环区域
    if (loopRegion && loopRegion.start < loopRegion.end) {
      const startPos = (loopRegion.start / duration) * 2 - 1;
      const endPos = (loopRegion.end / duration) * 2 - 1;
      
      // 绘制半透明矩形
      const loopVertices = new Float32Array([
        startPos, -1.0,
        endPos, -1.0,
        startPos, 1.0,
        endPos, 1.0
      ]);
      
      gl.bufferData(gl.ARRAY_BUFFER, loopVertices, gl.STATIC_DRAW);
      gl.uniform4fv(program.colorUniformLocation, themeColors.selection);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      
      // 绘制边界线
      const boundaryVertices = new Float32Array([
        startPos, -1.0,
        startPos, 1.0,
        endPos, -1.0,
        endPos, 1.0
      ]);
      
      gl.bufferData(gl.ARRAY_BUFFER, boundaryVertices, gl.STATIC_DRAW);
      gl.uniform4fv(program.colorUniformLocation, themeColors.waveform);
      gl.drawArrays(gl.LINES, 0, 4);
    }
    
    // 绘制书签
    if (bookmarks && bookmarks.length > 0) {
      for (const bookmark of bookmarks) {
        const bookmarkPos = (bookmark.time / duration) * 2 - 1;
        
        // 绘制标记线
        const markerVertices = new Float32Array([
          bookmarkPos, -1.0,
          bookmarkPos, 1.0
        ]);
        
        gl.bufferData(gl.ARRAY_BUFFER, markerVertices, gl.STATIC_DRAW);
        gl.uniform4fv(program.colorUniformLocation, [0.1, 0.8, 0.3, 1.0]);
        gl.drawArrays(gl.LINES, 0, 2);
        
        // 实际产品中这里应该绘制三角形标记
        // 为简化示例，这里省略
      }
    }
    
    // 正在选择循环区域
    if (isLoopSelecting && loopStart !== null) {
      const startPos = (loopStart / duration) * 2 - 1;
      const currentPos = (currentTime / duration) * 2 - 1;
      
      // 绘制临时选择区域
      const selectionVertices = new Float32Array([
        startPos, -1.0,
        currentPos, -1.0,
        startPos, 1.0,
        currentPos, 1.0
      ]);
      
      gl.bufferData(gl.ARRAY_BUFFER, selectionVertices, gl.STATIC_DRAW);
      gl.uniform4fv(program.colorUniformLocation, themeColors.selection);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    
    // 更新渲染时间
    setLastRenderTime(Date.now());
  }, [canvasSize, currentTime, duration, loopRegion, bookmarks, isLoopSelecting, loopStart, themeColors]);
  
  // 创建波形顶点数据
  const createWaveformVertices = (waveformData, width, height) => {
    const vertices = new Float32Array(waveformData.length * 2);
    
    for (let i = 0; i < waveformData.length; i++) {
      // X坐标 (-1 到 1)
      const x = (i / (waveformData.length - 1)) * 2 - 1;
      // Y坐标 (-1 到 1)
      const y = waveformData[i] * 2 - 1;
      
      vertices[i * 2] = x;
      vertices[i * 2 + 1] = y;
    }
    
    return vertices;
  };
  
  // 获取鼠标事件的时间位置
  const getTimeFromPosition = useCallback((clientX) => {
    if (!containerRef.current || duration <= 0) return 0;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = x / rect.width;
    
    return Math.max(0, Math.min(duration, ratio * duration));
  }, [duration]);
  
  // 鼠标按下事件处理
  const handleMouseDown = useCallback((e) => {
    const time = getTimeFromPosition(e.clientX);
    
    if (e.altKey) {
      // Alt键按下时开始选择循环区域
      setIsLoopSelecting(true);
      setLoopStart(time);
    } else {
      // 否则开始拖动进度（跳转）
      setIsDragging(true);
      onSeek(time);
    }
  }, [getTimeFromPosition, onSeek]);
  
  // 鼠标移动事件处理
  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      // 拖动时更新播放位置
      const time = getTimeFromPosition(e.clientX);
      onSeek(time);
    } else if (isLoopSelecting && loopStart !== null) {
      // 选择循环区域时更新当前位置
      const time = getTimeFromPosition(e.clientX);
      onSeek(time);
    }
  }, [isDragging, isLoopSelecting, loopStart, getTimeFromPosition, onSeek]);
  
  // 鼠标释放事件处理
  const handleMouseUp = useCallback((e) => {
    if (isLoopSelecting && loopStart !== null) {
      // 完成循环区域选择
      const endTime = getTimeFromPosition(e.clientX);
      const start = Math.min(loopStart, endTime);
      const end = Math.max(loopStart, endTime);
      
      if (end - start > 0.5) { // 至少0.5秒
        onSetLoop(start, end);
      }
      
      setIsLoopSelecting(false);
      setLoopStart(null);
    }
    
    setIsDragging(false);
  }, [isLoopSelecting, loopStart, getTimeFromPosition, onSetLoop]);
  
  // 鼠标双击事件处理
  const handleDoubleClick = useCallback((e) => {
    // 添加书签功能 - 实际应用中需在组件外实现
    console.log('双击添加书签，位置:', getTimeFromPosition(e.clientX));
  }, [getTimeFromPosition]);
  
  // 大小调整处理
  const handleResize = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    const { width, height } = containerRef.current.getBoundingClientRect();
    
    // 设置canvas尺寸
    canvasRef.current.width = width * window.devicePixelRatio;
    canvasRef.current.height = height * window.devicePixelRatio;
    canvasRef.current.style.width = `${width}px`;
    canvasRef.current.style.height = `${height}px`;
    
    setCanvasSize({ width: canvasRef.current.width, height: canvasRef.current.height });
    
    requestAnimationFrame(renderFrame);
  }, [renderFrame]);
  
  // 动画循环
  const animate = useCallback(() => {
    renderFrame();
    animationRef.current = requestAnimationFrame(animate);
  }, [renderFrame]);
  
  // 格式化时间显示
  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // 初始化WebGL
  useEffect(() => {
    const success = initWebGL();
    if (success) {
      // 初始化尺寸
      handleResize();
      
      // 添加窗口大小调整监听
      window.addEventListener('resize', handleResize);
      
      // 启动动画循环
      animate();
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [initWebGL, handleResize, animate]);
  
  // 音频数据变化时重新处理
  useEffect(() => {
    if (audioData) {
      processAudioData();
    }
  }, [audioData, processAudioData]);
  
  // 当前时间变化时触发渲染
  useEffect(() => {
    // 限制渲染频率，避免性能问题
    const now = Date.now();
    if (now - lastRenderTime > 30) { // 约33fps
      requestAnimationFrame(renderFrame);
    }
  }, [currentTime, renderFrame, lastRenderTime]);
  
  // 添加事件监听
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('dblclick', handleDoubleClick);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('dblclick', handleDoubleClick);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleDoubleClick]);
  
  return (
    <div 
      ref={containerRef}
      className="webgl-waveform-container relative w-full h-32 bg-gray-900 rounded cursor-pointer"
    >
      <canvas 
        ref={canvasRef}
        className="w-full h-full"
      />
      
      {/* 时间显示 */}
      <div className="absolute bottom-2 right-2 text-xs bg-black bg-opacity-50 text-white px-2 py-1 rounded">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
      
      {/* Alt键提示 */}
      <div className="absolute top-2 right-2 text-xs bg-black bg-opacity-50 text-white px-2 py-1 rounded">
        按住Alt并拖动设置AB循环区域
      </div>
    </div>
  );
} 