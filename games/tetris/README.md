# 俄罗斯方块（Tetris）- Web 版

一个纯原生 HTML/CSS/JS 的俄罗斯方块小游戏（无需依赖）。

## 运行

直接用浏览器打开：

- `games/tetris/index.html`

或用一个静态服务器（可选）：

```bash
cd openclaw
python3 -m http.server 8000
```
然后打开 `http://localhost:8000`。

## 操作

- ← / →：左右移动
- ↓：加速下落（soft drop）
- ↑：旋转
- Space：硬降（hard drop）
- C：暂存（hold）
- P：暂停/继续
- R：重新开始

## 目标

尽量消行获得更高分数；每消一定行数会升级，下落速度加快。
