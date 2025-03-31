#!/bin/bash

# 这个脚本将导入路径从 github.com/YYvanYang/language-learning 改为 language-learning

echo "开始更新导入路径..."
echo "将 github.com/YYvanYang/language-learning 替换为 language-learning"

# 查找所有包含旧导入路径的Go文件
FILES=$(find . -type f -name "*.go" | xargs grep -l "github.com/YYvanYang/language-learning")

# 记录处理文件数
COUNT=0

# 处理每个文件
for FILE in $FILES; do
  # 替换导入路径
  sed -i '' 's|github.com/YYvanYang/language-learning|language-learning|g' "$FILE"
  
  # 计数器加1
  COUNT=$((COUNT+1))
  
  echo "处理文件: $FILE"
done

echo "导入路径更新完成!"
echo "共处理了 $COUNT 个文件"
echo ""
echo "运行 go mod tidy 更新依赖..."

# 运行go mod tidy更新依赖
go mod tidy

echo "完成!" 