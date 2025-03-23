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
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const STATUS_FILE = path.join(__dirname, '..', 'PROJECT_STATUS.md');
const DATE_OPTIONS = { year: 'numeric', month: '2-digit', day: '2-digit' };
const TODAY = new Date().toLocaleDateString('zh-CN', DATE_OPTIONS).replace(/\//g, '-');

// 创建命令行交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * 读取状态文件
 */
function readStatusFile() {
  try {
    return fs.readFileSync(STATUS_FILE, 'utf8');
  } catch (error) {
    console.error('无法读取项目状态文件:', error.message);
    process.exit(1);
  }
}

/**
 * 写入状态文件
 */
function writeStatusFile(content) {
  try {
    fs.writeFileSync(STATUS_FILE, content, 'utf8');
    console.log('项目状态文件已更新！');
  } catch (error) {
    console.error('无法写入项目状态文件:', error.message);
    process.exit(1);
  }
}

/**
 * 添加已完成功能
 */
function addCompletedFeature() {
  rl.question('输入功能名称: ', (feature) => {
    rl.question('输入相关文件 (可选): ', (file) => {
      rl.question('选择类别 (前端/后端/WebAssembly): ', (category) => {
        let categorySection;
        
        switch (category.toLowerCase()) {
          case '前端':
            categorySection = '### 前端';
            break;
          case '后端':
            categorySection = '### 后端';
            break;
          case 'webassembly':
          case 'wasm':
            categorySection = '### WebAssembly';
            break;
          default:
            categorySection = '### 前端';
            break;
        }
        
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
          console.error(`找不到类别: ${categorySection}`);
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
  rl.question('输入功能名称: ', (feature) => {
    rl.question('是否是子功能? (y/n): ', (isSub) => {
      rl.question('选择类别 (前端/后端/WebAssembly): ', (category) => {
        let categorySection;
        
        switch (category.toLowerCase()) {
          case '前端':
            categorySection = '### 前端';
            break;
          case '后端':
            categorySection = '### 后端';
            break;
          case 'webassembly':
          case 'wasm':
            categorySection = '### WebAssembly';
            break;
          default:
            categorySection = '### 前端';
            break;
        }
        
        const content = readStatusFile();
        const lines = content.split('\n');
        
        // 找到待完成部分的对应类别
        let foundPending = false;
        let insertIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
          if (!foundPending && lines[i].trim() === '## 🟠 待完成功能') {
            foundPending = true;
          }
          
          if (foundPending && lines[i].trim() === categorySection) {
            // 查找该类别中最后一个待完成项
            for (let j = i + 1; j < lines.length; j++) {
              if (lines[j].trim().startsWith('- ⬜') || lines[j].trim().startsWith('  - ⬜')) {
                insertIndex = j;
              } else if (lines[j].trim().startsWith('###') || lines[j].trim() === '## 📅 更新日志') {
                break;
              }
            }
            
            if (insertIndex === -1) {
              // 如果没有找到任何待完成项，就在类别标题后插入
              insertIndex = i;
            }
            break;
          }
        }
        
        if (insertIndex === -1) {
          console.error(`找不到待完成类别: ${categorySection}`);
          rl.close();
          return;
        }
        
        // 构建新功能条目
        let newFeature = isSub.toLowerCase() === 'y' ?
          `  - ⬜ ${feature}` :
          `- ⬜ ${feature}`;
        
        // 插入新功能
        lines.splice(insertIndex + 1, 0, newFeature);
        
        writeStatusFile(lines.join('\n'));
        rl.close();
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
  
  for (let i = 0; i < lines.length; i++) {
    if (!foundPending && lines[i].trim() === '## 🟠 待完成功能') {
      foundPending = true;
      continue;
    }
    
    if (foundPending && lines[i].trim() === '## 📅 更新日志') {
      break;
    }
    
    if (foundPending && (lines[i].trim().startsWith('- ⬜') || lines[i].trim().startsWith('  - ⬜'))) {
      pendingFeatures.push({
        index: i,
        text: lines[i].trim().replace('⬜', '').trim(),
        isSubFeature: lines[i].trim().startsWith('  - ')
      });
    }
  }
  
  if (pendingFeatures.length === 0) {
    console.log('没有找到待完成功能!');
    rl.close();
    return;
  }
  
  // 显示待完成功能列表
  console.log('待完成功能:');
  pendingFeatures.forEach((feature, index) => {
    console.log(`${index + 1}. ${feature.text}${feature.isSubFeature ? ' (子功能)' : ''}`);
  });
  
  rl.question('选择要标记为已完成的功能 (输入数字): ', (choice) => {
    const index = parseInt(choice) - 1;
    
    if (isNaN(index) || index < 0 || index >= pendingFeatures.length) {
      console.error('无效选择!');
      rl.close();
      return;
    }
    
    const feature = pendingFeatures[index];
    
    // 从待完成部分移除
    lines[feature.index] = lines[feature.index].replace('⬜', '✅');
    
    // 确定要添加到哪个已完成类别
    let category = '';
    for (let i = feature.index - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith('### ')) {
        category = lines[i].trim();
        break;
      }
    }
    
    if (!category) {
      console.error('无法确定功能类别!');
      rl.close();
      return;
    }
    
    // 找到已完成部分的对应类别
    let completedCategoryIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '## 🟢 已完成功能') {
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() === category) {
            completedCategoryIndex = j;
            break;
          }
        }
        break;
      }
    }
    
    if (completedCategoryIndex === -1) {
      console.error(`找不到已完成类别: ${category}`);
      rl.close();
      return;
    }
    
    // 构建新的已完成功能条目
    let completedFeature = feature.isSubFeature ?
      `  - ✅ ${feature.text}` :
      `- ✅ ${feature.text}`;
    
    // 添加到已完成部分
    lines.splice(completedCategoryIndex + 1, 0, completedFeature);
    
    // 移除从待完成部分
    lines.splice(feature.index, 1);
    
    // 添加日志条目
    addLogEntry(lines, feature.text);
    
    writeStatusFile(lines.join('\n'));
    rl.close();
  });
}

/**
 * 添加日志条目
 */
function addLogEntry(lines, feature = null) {
  if (!feature) {
    rl.question('输入日志内容: ', (logContent) => {
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
    console.error('找不到更新日志部分!');
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
项目状态更新脚本
用法: node scripts/update-status.js [命令]

命令:
  add-completed   添加已完成功能
  add-pending     添加待完成功能
  mark-completed  将待完成功能标记为已完成
  add-log         添加日志条目
  help            显示此帮助信息
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
    default:
      console.error(`未知命令: ${command}`);
      showHelp();
  }
}

// 启动脚本
main(); 