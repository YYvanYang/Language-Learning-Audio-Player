#!/usr/bin/env node

/**
 * 项目状态更新脚本
 * 用法: node scripts/update-status.js [命令] [参数]
 * 
 * 命令:
 *   add-completed   添加已完成功能
 *   add-pending     添加待完成功能
 *   mark-completed  将待完成功能标记为已完成
 *   add-log         添加日志条目
 *   set-priority    设置功能优先级
 *   move-feature    移动功能到其他类别
 *   show-progress   显示项目完成进度
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const STATUS_FILE = path.join(__dirname, '..', 'PROJECT_STATUS.md');
const DATE_OPTIONS = { year: 'numeric', month: '2-digit', day: '2-digit' };
const TODAY = new Date().toLocaleDateString('zh-CN', DATE_OPTIONS).replace(/\//g, '-');

// 控制台颜色
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// 类别映射
const CATEGORIES = {
  '前端核心': '### 前端核心功能',
  '前端可视化': '### 前端音频分析与可视化',
  '前端处理': '### 前端音频处理增强',
  '前端性能': '### 前端性能优化',
  '前端学习': '### 前端语言学习功能',
  '后端': '### 后端',
  'webassembly': '### WebAssembly',
  'wasm': '### WebAssembly'
};

// 优先级映射
const PRIORITIES = {
  '高': '[高]',
  '中': '[中]',
  '低': '[低]'
};

// 创建命令行交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * 颜色化输出
 */
function colorize(text, color) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

/**
 * 读取状态文件
 */
function readStatusFile() {
  try {
    return fs.readFileSync(STATUS_FILE, 'utf8');
  } catch (error) {
    console.error(colorize('错误: 无法读取项目状态文件:', 'red'), error.message);
    process.exit(1);
  }
}

/**
 * 写入状态文件
 */
function writeStatusFile(content) {
  try {
    fs.writeFileSync(STATUS_FILE, content, 'utf8');
    console.log(colorize('✅ 项目状态文件已更新！', 'green'));
  } catch (error) {
    console.error(colorize('错误: 无法写入项目状态文件:', 'red'), error.message);
    process.exit(1);
  }
}

/**
 * 获取所有类别
 */
function getAllCategories() {
  const content = readStatusFile();
  const lines = content.split('\n');
  const categories = [];
  
  // 找到已完成和待完成部分的所有类别
  lines.forEach(line => {
    if (line.trim().startsWith('### ')) {
      categories.push(line.trim());
    }
  });
  
  return [...new Set(categories)]; // 去重
}

/**
 * 添加已完成功能
 */
function addCompletedFeature() {
  rl.question(colorize('输入功能名称: ', 'cyan'), (feature) => {
    rl.question(colorize('输入相关文件 (可选): ', 'cyan'), (file) => {
      // 获取所有已完成类别
      const allCategories = getAllCategories();
      const completedCategories = allCategories.filter(cat => {
        const content = readStatusFile();
        const lines = content.split('\n');
        let foundCompleted = false;
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim() === '## 🟢 已完成功能') {
            foundCompleted = true;
          }
          
          if (foundCompleted && lines[i].trim() === '## 🟠 待完成功能') {
            break;
          }
          
          if (foundCompleted && lines[i].trim() === cat) {
            return true;
          }
        }
        
        return false;
      });
      
      console.log(colorize('\n可用类别:', 'bright'));
      completedCategories.forEach((cat, index) => {
        console.log(`${index + 1}. ${cat.replace('### ', '')}`);
      });
      
      rl.question(colorize('\n选择类别 (输入数字): ', 'cyan'), (choice) => {
        const index = parseInt(choice) - 1;
        
        if (isNaN(index) || index < 0 || index >= completedCategories.length) {
          console.error(colorize('错误: 无效的类别选择', 'red'));
          rl.close();
          return;
        }
        
        const categorySection = completedCategories[index];
        const content = readStatusFile();
        const lines = content.split('\n');
        
        // 找到对应类别部分
        let insertIndex = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim() === categorySection) {
            // 查找该类别中最后一个已完成项
            for (let j = i + 1; j < lines.length; j++) {
              if (lines[j].trim().startsWith('- ✅')) {
                insertIndex = j;
              } else if (lines[j].trim().startsWith('##') || lines[j].trim() === '') {
                break;
              }
            }
            
            if (insertIndex === -1) {
              // 如果没有找到任何已完成项，就在类别标题后插入
              insertIndex = i;
            }
            break;
          }
        }
        
        if (insertIndex === -1) {
          console.error(colorize(`错误: 找不到类别: ${categorySection}`, 'red'));
          rl.close();
          return;
        }
        
        // 构建新功能条目
        let newFeature = `- ✅ ${feature}`;
        if (file) {
          newFeature += ` (\`${file}\`)`;
        }
        
        // 插入新功能
        lines.splice(insertIndex + 1, 0, newFeature);
        
        // 添加日志条目
        addLogEntry(lines, feature);
        
        writeStatusFile(lines.join('\n'));
        rl.close();
      });
    });
  });
}

/**
 * 添加待完成功能
 */
function addPendingFeature() {
  rl.question(colorize('输入功能名称: ', 'cyan'), (feature) => {
    rl.question(colorize('是否是子功能? (y/n): ', 'cyan'), (isSub) => {
      // 显示待完成功能的所有类别
      const content = readStatusFile();
      const lines = content.split('\n');
      const pendingCategories = [];
      
      let foundPending = false;
      for (let i = 0; i < lines.length; i++) {
        if (!foundPending && lines[i].trim() === '## 🟠 待完成功能') {
          foundPending = true;
          continue;
        }
        
        if (foundPending && lines[i].trim() === '## 📅 更新日志') {
          break;
        }
        
        if (foundPending && lines[i].trim().startsWith('### ')) {
          pendingCategories.push(lines[i].trim());
        }
      }
      
      console.log(colorize('\n可用类别:', 'bright'));
      pendingCategories.forEach((cat, index) => {
        console.log(`${index + 1}. ${cat.replace('### ', '')}`);
      });
      
      rl.question(colorize('\n选择类别 (输入数字): ', 'cyan'), (categoryChoice) => {
        const categoryIndex = parseInt(categoryChoice) - 1;
        
        if (isNaN(categoryIndex) || categoryIndex < 0 || categoryIndex >= pendingCategories.length) {
          console.error(colorize('错误: 无效的类别选择', 'red'));
          rl.close();
          return;
        }
        
        const categorySection = pendingCategories[categoryIndex];
        
        // 选择优先级
        console.log(colorize('\n选择优先级:', 'bright'));
        console.log(`1. ${colorize('[高]', 'red')} - 高优先级`);
        console.log(`2. ${colorize('[中]', 'yellow')} - 中优先级`);
        console.log(`3. ${colorize('[低]', 'blue')} - 低优先级`);
        
        rl.question(colorize('\n选择优先级 (输入数字): ', 'cyan'), (priorityChoice) => {
          let priority;
          switch (priorityChoice) {
            case '1':
              priority = '[高]';
              break;
            case '2':
              priority = '[中]';
              break;
            case '3':
              priority = '[低]';
              break;
            default:
              console.error(colorize('错误: 无效的优先级选择，使用默认优先级[中]', 'red'));
              priority = '[中]';
          }
          
          // 找到待完成部分的对应类别
          let insertIndex = -1;
          
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === categorySection) {
              // 查找该类别中优先级相同的最后一个待完成项
              for (let j = i + 1; j < lines.length; j++) {
                const line = lines[j].trim();
                if ((line.startsWith('- ⬜') || line.startsWith('  - ⬜')) && 
                    line.includes(priority)) {
                  insertIndex = j;
                } else if (line.startsWith('### ') || line === '## 📅 更新日志') {
                  break;
                }
              }
              
              // 如果没找到相同优先级的，找类别中的任何一个待完成项
              if (insertIndex === -1) {
                for (let j = i + 1; j < lines.length; j++) {
                  const line = lines[j].trim();
                  if (line.startsWith('- ⬜') || line.startsWith('  - ⬜')) {
                    insertIndex = j;
                  } else if (line.startsWith('### ') || line === '## 📅 更新日志') {
                    break;
                  }
                }
              }
              
              // 如果还是没找到，就在类别标题后插入
              if (insertIndex === -1) {
                insertIndex = i;
              }
              break;
            }
          }
          
          if (insertIndex === -1) {
            console.error(colorize(`错误: 找不到待完成类别: ${categorySection}`, 'red'));
            rl.close();
            return;
          }
          
          // 构建新功能条目
          let newFeature = isSub.toLowerCase() === 'y' ?
            `  - ⬜ ${priority} ${feature}` :
            `- ⬜ ${priority} ${feature}`;
          
          // 插入新功能
          lines.splice(insertIndex + 1, 0, newFeature);
          
          writeStatusFile(lines.join('\n'));
          console.log(colorize(`\n✅ 已添加待完成功能: ${feature} (${priority})`, 'green'));
          rl.close();
        });
      });
    });
  });
}

/**
 * 将待完成功能标记为已完成
 */
function markFeatureCompleted() {
  const content = readStatusFile();
  const lines = content.split('\n');
  
  // 收集所有待完成功能
  const pendingFeatures = [];
  let foundPending = false;
  let currentCategory = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!foundPending && line === '## 🟠 待完成功能') {
      foundPending = true;
      continue;
    }
    
    if (foundPending && line === '## 📅 更新日志') {
      break;
    }
    
    if (foundPending && line.startsWith('### ')) {
      currentCategory = line;
    }
    
    if (foundPending && (line.startsWith('- ⬜') || line.startsWith('  - ⬜'))) {
      // 提取优先级标记和功能名称
      let priority = '';
      let text = line.replace('⬜', '').trim();
      
      const priorityMatch = text.match(/^\[(高|中|低)\]/);
      if (priorityMatch) {
        priority = priorityMatch[0];
        text = text.replace(priority, '').trim();
      }
      
      pendingFeatures.push({
        index: i,
        text,
        priority,
        isSubFeature: line.startsWith('  - '),
        category: currentCategory
      });
    }
  }
  
  if (pendingFeatures.length === 0) {
    console.log(colorize('没有找到待完成功能!', 'yellow'));
    rl.close();
    return;
  }
  
  // 显示待完成功能列表
  console.log(colorize('待完成功能:', 'bright'));
  pendingFeatures.forEach((feature, index) => {
    let displayText = `${index + 1}. `;
    
    // 添加优先级颜色
    if (feature.priority === '[高]') {
      displayText += colorize(feature.priority, 'red') + ' ';
    } else if (feature.priority === '[中]') {
      displayText += colorize(feature.priority, 'yellow') + ' ';
    } else if (feature.priority === '[低]') {
      displayText += colorize(feature.priority, 'blue') + ' ';
    }
    
    displayText += `${feature.text}`;
    
    if (feature.isSubFeature) {
      displayText += colorize(' (子功能)', 'magenta');
    }
    
    displayText += colorize(` - ${feature.category.replace('### ', '')}`, 'cyan');
    
    console.log(displayText);
  });
  
  rl.question(colorize('\n选择要标记为已完成的功能 (输入数字): ', 'cyan'), (choice) => {
    const index = parseInt(choice) - 1;
    
    if (isNaN(index) || index < 0 || index >= pendingFeatures.length) {
      console.error(colorize('错误: 无效选择!', 'red'));
      rl.close();
      return;
    }
    
    const feature = pendingFeatures[index];
    
    // 从待完成部分移除
    const pendingLine = lines[feature.index];
    const completedLine = pendingLine
      .replace('⬜', '✅')
      .replace(feature.priority, ''); // 移除优先级标记
    
    lines[feature.index] = completedLine;
    
    // 确定已完成部分对应的类别
    const pendingCategory = feature.category;
    let completedCategory = pendingCategory;
    
    // 映射待完成类别到已完成类别
    if (pendingCategory.includes('前端')) {
      completedCategory = '### 前端';
    }
    
    // 找到已完成部分的对应类别
    let completedCategoryIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '## 🟢 已完成功能') {
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() === completedCategory) {
            completedCategoryIndex = j;
            break;
          }
        }
        break;
      }
    }
    
    if (completedCategoryIndex === -1) {
      console.error(colorize(`错误: 找不到已完成类别: ${completedCategory}`, 'red'));
      rl.close();
      return;
    }
    
    // 构建新的已完成功能条目
    let completedFeature = feature.isSubFeature ?
      `  - ✅ ${feature.text}` :
      `- ✅ ${feature.text}`;
    
    // 添加到已完成部分
    lines.splice(completedCategoryIndex + 1, 0, completedFeature);
    
    // 移除待完成部分
    lines.splice(feature.index, 1);
    
    // 添加日志条目
    addLogEntry(lines, feature.text);
    
    writeStatusFile(lines.join('\n'));
    console.log(colorize(`\n✅ 已将功能标记为完成: ${feature.text}`, 'green'));
    rl.close();
  });
}

/**
 * 设置功能优先级
 */
function setFeaturePriority() {
  const content = readStatusFile();
  const lines = content.split('\n');
  
  // 收集所有待完成功能
  const pendingFeatures = [];
  let foundPending = false;
  let currentCategory = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!foundPending && line === '## 🟠 待完成功能') {
      foundPending = true;
      continue;
    }
    
    if (foundPending && line === '## 📅 更新日志') {
      break;
    }
    
    if (foundPending && line.startsWith('### ')) {
      currentCategory = line;
    }
    
    if (foundPending && (line.startsWith('- ⬜') || line.startsWith('  - ⬜'))) {
      // 提取优先级标记和功能名称
      let priority = '';
      let text = line.replace('⬜', '').trim();
      
      const priorityMatch = text.match(/^\[(高|中|低)\]/);
      if (priorityMatch) {
        priority = priorityMatch[0];
        text = text.replace(priority, '').trim();
      }
      
      pendingFeatures.push({
        index: i,
        text,
        priority,
        line: line,
        isSubFeature: line.startsWith('  - '),
        category: currentCategory
      });
    }
  }
  
  if (pendingFeatures.length === 0) {
    console.log(colorize('没有找到待完成功能!', 'yellow'));
    rl.close();
    return;
  }
  
  // 显示待完成功能列表
  console.log(colorize('待完成功能:', 'bright'));
  pendingFeatures.forEach((feature, index) => {
    let displayText = `${index + 1}. `;
    
    // 添加优先级颜色
    if (feature.priority === '[高]') {
      displayText += colorize(feature.priority, 'red') + ' ';
    } else if (feature.priority === '[中]') {
      displayText += colorize(feature.priority, 'yellow') + ' ';
    } else if (feature.priority === '[低]') {
      displayText += colorize(feature.priority, 'blue') + ' ';
    } else {
      displayText += colorize('[无]', 'reset') + ' ';
    }
    
    displayText += `${feature.text}`;
    
    if (feature.isSubFeature) {
      displayText += colorize(' (子功能)', 'magenta');
    }
    
    displayText += colorize(` - ${feature.category.replace('### ', '')}`, 'cyan');
    
    console.log(displayText);
  });
  
  rl.question(colorize('\n选择要修改优先级的功能 (输入数字): ', 'cyan'), (choice) => {
    const index = parseInt(choice) - 1;
    
    if (isNaN(index) || index < 0 || index >= pendingFeatures.length) {
      console.error(colorize('错误: 无效选择!', 'red'));
      rl.close();
      return;
    }
    
    const feature = pendingFeatures[index];
    
    // 选择新优先级
    console.log(colorize('\n选择新优先级:', 'bright'));
    console.log(`1. ${colorize('[高]', 'red')} - 高优先级`);
    console.log(`2. ${colorize('[中]', 'yellow')} - 中优先级`);
    console.log(`3. ${colorize('[低]', 'blue')} - 低优先级`);
    
    rl.question(colorize('\n选择优先级 (输入数字): ', 'cyan'), (priorityChoice) => {
      let newPriority;
      switch (priorityChoice) {
        case '1':
          newPriority = '[高]';
          break;
        case '2':
          newPriority = '[中]';
          break;
        case '3':
          newPriority = '[低]';
          break;
        default:
          console.error(colorize('错误: 无效的优先级选择，使用默认优先级[中]', 'red'));
          newPriority = '[中]';
      }
      
      // 更新功能行
      let updatedLine = feature.line;
      
      if (feature.priority) {
        updatedLine = updatedLine.replace(feature.priority, newPriority);
      } else {
        const prefix = feature.isSubFeature ? '  - ⬜ ' : '- ⬜ ';
        updatedLine = `${prefix}${newPriority} ${feature.text}`;
      }
      
      lines[feature.index] = updatedLine;
      
      writeStatusFile(lines.join('\n'));
      console.log(colorize(`\n✅ 已更新优先级: ${feature.text} -> ${newPriority}`, 'green'));
      rl.close();
    });
  });
}

/**
 * 移动功能到其他类别
 */
function moveFeature() {
  const content = readStatusFile();
  const lines = content.split('\n');
  
  // 收集所有待完成功能
  const pendingFeatures = [];
  let foundPending = false;
  let currentCategory = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!foundPending && line === '## 🟠 待完成功能') {
      foundPending = true;
      continue;
    }
    
    if (foundPending && line === '## 📅 更新日志') {
      break;
    }
    
    if (foundPending && line.startsWith('### ')) {
      currentCategory = line;
    }
    
    if (foundPending && (line.startsWith('- ⬜') || line.startsWith('  - ⬜'))) {
      // 提取优先级标记和功能名称
      let priority = '';
      let text = line.replace('⬜', '').trim();
      
      const priorityMatch = text.match(/^\[(高|中|低)\]/);
      if (priorityMatch) {
        priority = priorityMatch[0];
        text = text.replace(priority, '').trim();
      }
      
      pendingFeatures.push({
        index: i,
        text,
        priority,
        line: line,
        isSubFeature: line.startsWith('  - '),
        category: currentCategory
      });
    }
  }
  
  if (pendingFeatures.length === 0) {
    console.log(colorize('没有找到待完成功能!', 'yellow'));
    rl.close();
    return;
  }
  
  // 显示待完成功能列表
  console.log(colorize('待完成功能:', 'bright'));
  pendingFeatures.forEach((feature, index) => {
    let displayText = `${index + 1}. `;
    
    // 添加优先级颜色
    if (feature.priority === '[高]') {
      displayText += colorize(feature.priority, 'red') + ' ';
    } else if (feature.priority === '[中]') {
      displayText += colorize(feature.priority, 'yellow') + ' ';
    } else if (feature.priority === '[低]') {
      displayText += colorize(feature.priority, 'blue') + ' ';
    } else {
      displayText += colorize('[无]', 'reset') + ' ';
    }
    
    displayText += `${feature.text}`;
    
    if (feature.isSubFeature) {
      displayText += colorize(' (子功能)', 'magenta');
    }
    
    displayText += colorize(` - ${feature.category.replace('### ', '')}`, 'cyan');
    
    console.log(displayText);
  });
  
  rl.question(colorize('\n选择要移动的功能 (输入数字): ', 'cyan'), (choice) => {
    const index = parseInt(choice) - 1;
    
    if (isNaN(index) || index < 0 || index >= pendingFeatures.length) {
      console.error(colorize('错误: 无效选择!', 'red'));
      rl.close();
      return;
    }
    
    const feature = pendingFeatures[index];
    
    // 收集所有可用类别
    const categories = [];
    let foundPending = false;
    
    for (let i = 0; i < lines.length; i++) {
      if (!foundPending && lines[i].trim() === '## 🟠 待完成功能') {
        foundPending = true;
        continue;
      }
      
      if (foundPending && lines[i].trim() === '## 📅 更新日志') {
        break;
      }
      
      if (foundPending && lines[i].trim().startsWith('### ')) {
        categories.push({
          index: i,
          name: lines[i].trim()
        });
      }
    }
    
    console.log(colorize('\n可用类别:', 'bright'));
    categories.forEach((cat, idx) => {
      const highlight = cat.name === feature.category ? colorize(' (当前)', 'yellow') : '';
      console.log(`${idx + 1}. ${cat.name.replace('### ', '')}${highlight}`);
    });
    
    rl.question(colorize('\n选择目标类别 (输入数字): ', 'cyan'), (catChoice) => {
      const catIndex = parseInt(catChoice) - 1;
      
      if (isNaN(catIndex) || catIndex < 0 || catIndex >= categories.length) {
        console.error(colorize('错误: 无效的类别选择', 'red'));
        rl.close();
        return;
      }
      
      const targetCategory = categories[catIndex];
      
      // 如果是同一类别，不需要移动
      if (targetCategory.name === feature.category) {
        console.log(colorize('功能已经在该类别中，无需移动', 'yellow'));
        rl.close();
        return;
      }
      
      // 从原位置移除
      lines.splice(feature.index, 1);
      
      // 查找目标类别中第一个功能的位置
      let insertIndex = targetCategory.index;
      for (let i = targetCategory.index + 1; i < lines.length; i++) {
        if (lines[i].trim().startsWith('- ⬜') || lines[i].trim().startsWith('### ')) {
          insertIndex = i - 1;
          break;
        }
      }
      
      // 插入到新位置
      lines.splice(insertIndex + 1, 0, feature.line);
      
      writeStatusFile(lines.join('\n'));
      console.log(colorize(`\n✅ 已将功能移动到 ${targetCategory.name.replace('### ', '')}: ${feature.text}`, 'green'));
      rl.close();
    });
  });
}

/**
 * 显示项目完成进度
 */
function showProgress() {
  const content = readStatusFile();
  const lines = content.split('\n');
  
  // 统计已完成和待完成功能数量
  let completedCount = 0;
  let pendingCount = 0;
  let pendingHighPriority = 0;
  let pendingMediumPriority = 0;
  let pendingLowPriority = 0;
  
  let isCompleted = false;
  let isPending = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === '## 🟢 已完成功能') {
      isCompleted = true;
      isPending = false;
      continue;
    }
    
    if (line === '## 🟠 待完成功能') {
      isCompleted = false;
      isPending = true;
      continue;
    }
    
    if (line === '## 📅 更新日志') {
      isCompleted = false;
      isPending = false;
      continue;
    }
    
    if (isCompleted && line.startsWith('- ✅')) {
      completedCount++;
    }
    
    if (isPending && line.startsWith('- ⬜')) {
      pendingCount++;
      
      if (line.includes('[高]')) {
        pendingHighPriority++;
      } else if (line.includes('[中]')) {
        pendingMediumPriority++;
      } else if (line.includes('[低]')) {
        pendingLowPriority++;
      }
    }
  }
  
  const totalCount = completedCount + pendingCount;
  const completedPercentage = totalCount > 0 ? 
    Math.round((completedCount / totalCount) * 100) : 0;
  
  console.log(colorize('\n项目进度统计:', 'bright'));
  console.log(`总功能数: ${totalCount}`);
  console.log(`已完成功能: ${colorize(completedCount.toString(), 'green')} (${colorize(completedPercentage + '%', 'green')})`);
  console.log(`待完成功能: ${colorize(pendingCount.toString(), 'yellow')} (${colorize((100 - completedPercentage) + '%', 'yellow')})`);
  
  console.log(colorize('\n待完成功能优先级分布:', 'bright'));
  console.log(`高优先级: ${colorize(pendingHighPriority.toString(), 'red')}`);
  console.log(`中优先级: ${colorize(pendingMediumPriority.toString(), 'yellow')}`);
  console.log(`低优先级: ${colorize(pendingLowPriority.toString(), 'blue')}`);
  
  // 生成进度条
  const barLength = 30;
  const completedChars = Math.round((completedPercentage / 100) * barLength);
  const remainingChars = barLength - completedChars;
  
  const progressBar = 
    colorize('█'.repeat(completedChars), 'green') + 
    colorize('░'.repeat(remainingChars), 'yellow');
  
  console.log('\n进度条:');
  console.log(`${progressBar} ${completedPercentage}%`);
  
  rl.close();
}

/**
 * 添加日志条目
 */
function addLogEntry(lines, feature = null) {
  if (!feature) {
    rl.question(colorize('输入日志内容: ', 'cyan'), (logContent) => {
      addLogEntryInternal(lines, logContent);
      writeStatusFile(lines.join('\n'));
      rl.close();
    });
    return;
  }
  
  addLogEntryInternal(lines, `完成 ${feature}`);
}

/**
 * 添加日志条目内部实现
 */
function addLogEntryInternal(lines, logContent) {
  // 找到日志部分
  let logSectionIndex = -1;
  let todaySectionIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '## 📅 更新日志') {
      logSectionIndex = i;
    }
    
    if (logSectionIndex !== -1 && lines[i].trim() === `### ${TODAY}`) {
      todaySectionIndex = i;
      break;
    }
  }
  
  if (logSectionIndex === -1) {
    console.error(colorize('错误: 找不到更新日志部分!', 'red'));
    return;
  }
  
  // 如果今天的部分不存在，创建一个
  if (todaySectionIndex === -1) {
    lines.splice(logSectionIndex + 1, 0, '', `### ${TODAY}`);
    todaySectionIndex = logSectionIndex + 2;
  }
  
  // 添加日志条目
  lines.splice(todaySectionIndex + 1, 0, `- ✅ ${logContent}`);
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
${colorize('项目状态更新脚本', 'bright')}
用法: node scripts/update-status.js [命令]

${colorize('命令:', 'bright')}
  ${colorize('add-completed', 'green')}   添加已完成功能
  ${colorize('add-pending', 'yellow')}     添加待完成功能
  ${colorize('mark-completed', 'cyan')}  将待完成功能标记为已完成
  ${colorize('add-log', 'magenta')}         添加日志条目
  ${colorize('set-priority', 'blue')}     设置功能优先级
  ${colorize('move-feature', 'cyan')}     移动功能到其他类别
  ${colorize('show-progress', 'green')}   显示项目完成进度
  ${colorize('help', 'reset')}            显示此帮助信息
  `);
  process.exit(0);
}

/**
 * 主函数
 */
function main() {
  const command = process.argv[2];
  
  if (!command || command === 'help') {
    showHelp();
  }
  
  switch (command) {
    case 'add-completed':
      addCompletedFeature();
      break;
    case 'add-pending':
      addPendingFeature();
      break;
    case 'mark-completed':
      markFeatureCompleted();
      break;
    case 'add-log':
      addLogEntry(readStatusFile().split('\n'));
      break;
    case 'set-priority':
      setFeaturePriority();
      break;
    case 'move-feature':
      moveFeature();
      break;
    case 'show-progress':
      showProgress();
      break;
    default:
      console.error(colorize(`错误: 未知命令: ${command}`, 'red'));
      showHelp();
  }
}

// 启动脚本
main(); 