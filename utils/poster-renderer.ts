import UQRCode from "uqrcodejs";
import { BASE_URL } from "./env";
class PosterRenderer {
  canvasWidth;
  canvasHeight;
  contentEndY = 0;
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }
  /**
   * 主渲染入口
   * @param ctx H5: CanvasRenderingContext2D, 小程序: uni.createCanvasContext 返回值
   * @param template 模板配置
   * @param elements 已解析的元素数组
   * @param isH5 是否 H5 环境
   */
  async render(ctx, template, elements, isH5) {
    const width = template.canvasWidth || this.canvasWidth;
    const height = template.canvasHeight || this.canvasHeight;
    this.setFillStyle(ctx, template.backgroundColor || "#FFFFFF", isH5);
    this.fillRect(ctx, 0, 0, width, height, isH5);
    let maxY = 0;
    for (const element of elements) {
      try {
        await this.drawElement(ctx, element, isH5);
        const elementBottom = element.y + element.height;
        if (elementBottom > maxY)
          maxY = elementBottom;
      } catch (e) {
        console.warn(`[poster-renderer] \u7ED8\u5236\u5143\u7D20 ${element.elementKey} \u5931\u8D25:`, e);
      }
    }
    this.contentEndY = Math.ceil(maxY + 20);
  }
  // ==================== 元素分派 ====================
  async drawElement(ctx, element, isH5) {
    if (element.opacity !== void 0 && element.opacity < 1) {
      if (isH5) {
        ctx.globalAlpha = element.opacity;
      }
    }
    switch (element.elementType) {
      case "shape":
        this.drawShape(ctx, element, isH5);
        break;
      case "text":
        await this.drawText(ctx, element, isH5);
        break;
      case "image":
        await this.drawImage(ctx, element, isH5);
        break;
      case "qrcode":
        await this.drawQRCode(ctx, element, isH5);
        break;
    }
    if (isH5 && element.opacity !== void 0 && element.opacity < 1) {
      ctx.globalAlpha = 1;
    }
  }
  // ==================== Shape 绘制 ====================
  drawShape(ctx, element, isH5) {
    const { x, y, width, height, shapeType, shapeGradient, elementBgColor } = element;
    if (shapeType === "rect") {
      if (shapeGradient) {
        const gradient = this.createLinearGradient(ctx, x, y, x + width, y, isH5);
        this.addColorStop(gradient, 0, shapeGradient.from, isH5);
        this.addColorStop(gradient, 1, shapeGradient.to, isH5);
        this.setFillStyle(ctx, gradient, isH5);
        this.fillRect(ctx, x, y, width, height, isH5);
      } else if (elementBgColor) {
        const gradientColors = this.parseGradientColor(elementBgColor);
        if (gradientColors) {
          const gradient = this.createLinearGradient(ctx, x, y, x + width, y, isH5);
          this.addColorStop(gradient, 0, gradientColors[0], isH5);
          this.addColorStop(gradient, 1, gradientColors[1], isH5);
          this.setFillStyle(ctx, gradient, isH5);
        } else {
          this.setFillStyle(ctx, elementBgColor, isH5);
        }
        this.fillRect(ctx, x, y, width, height, isH5);
      }
    } else if (shapeType === "line") {
      this.setStrokeStyle(ctx, element.borderColor || "#cccccc", isH5);
      this.setLineWidth(ctx, element.borderWidth || 1, isH5);
      this.moveTo(ctx, x, y, isH5);
      this.lineTo(ctx, x + width, y, isH5);
      this.stroke(ctx, isH5);
    }
  }
  // ==================== Text 绘制 ====================
  async drawText(ctx, element, isH5) {
    const { x, y, width, height, fontSize, fontColor, fontWeight, fontFamily, textAlign, lineHeight } = element;
    const content = element.resolvedContent || element.defaultValue || "";
    if (!content)
      return;
    if (isH5) {
      ctx.font = `${fontWeight === "bold" ? "bold " : ""}${fontSize}px ${fontFamily || "sans-serif"}`;
      ctx.fillStyle = fontColor;
      ctx.textAlign = textAlign;
      ctx.textBaseline = "alphabetic";
    } else {
      ctx.setFontSize(fontSize);
      ctx.setFillStyle(fontColor);
      ctx.setTextAlign(textAlign);
      ctx.setTextBaseline("alphabetic");
    }
    let textX = x;
    if (textAlign === "center") {
      textX = x + width / 2;
    } else if (textAlign === "right") {
      textX = x + width;
    }
    if (element.elementBgColor) {
      const bgColors = this.parseGradientColor(element.elementBgColor);
      if (bgColors) {
        const gradient = this.createLinearGradient(ctx, x, y, x + width, y, isH5);
        this.addColorStop(gradient, 0, bgColors[0], isH5);
        this.addColorStop(gradient, 1, bgColors[1], isH5);
        this.setFillStyle(ctx, gradient, isH5);
      } else {
        this.setFillStyle(ctx, element.elementBgColor, isH5);
      }
      if (element.borderRadius > 0) {
        this.drawRoundedRectPath(ctx, x, y, width, height, element.borderRadius, isH5);
        this.fill(ctx, isH5);
      } else {
        this.fillRect(ctx, x, y, width, height, isH5);
      }
      if (isH5) {
        ctx.fillStyle = fontColor;
      } else {
        ctx.setFillStyle(fontColor);
      }
    }
    if (element.borderWidth > 0) {
      this.setStrokeStyle(ctx, element.borderColor, isH5);
      this.setLineWidth(ctx, element.borderWidth, isH5);
      if (element.borderRadius > 0) {
        this.drawRoundedRectPath(ctx, x, y, width, height, element.borderRadius, isH5);
        this.stroke(ctx, isH5);
      } else {
        this.strokeRect(ctx, x, y, width, height, isH5);
      }
    }
    const fontPx = fontSize;
    const lineH = fontPx * (lineHeight || 1.5);
    const startY = y + fontPx;
    if (isH5) {
      this.wrapTextH5(ctx, content, textX, startY, width, lineH);
    } else {
      this.wrapTextMP(ctx, content, textX, startY, width, lineH, fontSize);
    }
  }
  // ==================== Image 绘制 ====================
  async drawImage(ctx, element, isH5) {
    const { x, y, width, height, borderRadius, imageFit } = element;
    const src = element.resolvedContent || element.defaultValue || "";
    if (!src)
      return;
    try {
      if (isH5) {
        const img = await this.loadImageH5(src);
        if (!img)
          return;
        if (borderRadius > 0 && borderRadius >= width / 2 - 1) {
          this.drawCircularImageH5(ctx, img, x, y, width);
        } else if (borderRadius > 0) {
          ctx.save();
          this.drawRoundedRectPath(ctx, x, y, width, height, borderRadius, true);
          ctx.clip();
          ctx.drawImage(img, x, y, width, height);
          ctx.restore();
        } else {
          ctx.drawImage(img, x, y, width, height);
        }
      } else {
        const tempPath = await this.downloadImageMP(src);
        if (!tempPath)
          return;
        if (borderRadius > 0 && borderRadius >= width / 2 - 1) {
          this.drawCircularImageMP(ctx, tempPath, x, y, width);
        } else {
          ctx.drawImage(tempPath, x, y, width, height);
        }
      }
    } catch (e) {
      console.warn(`[poster-renderer] \u7ED8\u5236\u56FE\u7247 ${element.elementKey} \u5931\u8D25:`, e);
    }
  }
  // ==================== QRCode 绘制 ====================
  async drawQRCode(ctx, element, isH5) {
    const { x, y, qrSize, qrColor, qrBgColor } = element;
    const size = qrSize || element.width || 120;
    const content = element.resolvedContent || "";
    if (!content)
      return;
    try {
      const qr = new UQRCode();
      qr.data = content;
      qr.make();
      const modules = qr.modules;
      if (!modules || modules.length === 0)
        throw new Error("QR modules \u4E3A\u7A7A");
      const moduleCount = modules.length;
      const moduleSize = size / moduleCount;
      this.setFillStyle(ctx, qrBgColor || "#FFFFFF", isH5);
      this.fillRect(ctx, x, y, size, size, isH5);
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < modules[row].length; col++) {
          const cell = modules[row][col];
          const isDark = typeof cell === "object" ? cell?.isBlack : !!cell;
          if (isDark) {
            const mx = Math.floor(x + col * moduleSize);
            const my = Math.floor(y + row * moduleSize);
            const mw = Math.ceil(x + (col + 1) * moduleSize) - mx;
            const mh = Math.ceil(y + (row + 1) * moduleSize) - my;
            this.setFillStyle(ctx, qrColor || "#000000", isH5);
            this.fillRect(ctx, mx, my, mw, mh, isH5);
          }
        }
      }
    } catch (e) {
      console.error("[poster-renderer] \u751F\u6210\u4E8C\u7EF4\u7801\u5931\u8D25:", e);
    }
  }
  // ==================== 工具方法 ====================
  // --- 颜色/样式设置（H5/小程序兼容） ---
  setFillStyle(ctx, style, isH5) {
    if (isH5)
      ctx.fillStyle = style;
    else
      ctx.setFillStyle(style);
  }
  setStrokeStyle(ctx, style, isH5) {
    if (isH5)
      ctx.strokeStyle = style;
    else
      ctx.setStrokeStyle(style);
  }
  setLineWidth(ctx, width, isH5) {
    if (isH5)
      ctx.lineWidth = width;
    else
      ctx.setLineWidth(width);
  }
  fillRect(ctx, x, y, w, h, isH5) {
    ctx.fillRect(x, y, w, h);
  }
  strokeRect(ctx, x, y, w, h, isH5) {
    ctx.strokeRect(x, y, w, h);
  }
  fill(ctx, isH5) {
    ctx.fill();
  }
  stroke(ctx, isH5) {
    ctx.stroke();
  }
  moveTo(ctx, x, y, isH5) {
    ctx.moveTo(x, y);
  }
  lineTo(ctx, x, y, isH5) {
    ctx.lineTo(x, y);
  }
  createLinearGradient(ctx, x0, y0, x1, y1, isH5) {
    return ctx.createLinearGradient(x0, y0, x1, y1);
  }
  addColorStop(gradient, offset, color, isH5) {
    gradient.addColorStop(offset, color);
  }
  // --- 圆角矩形路径 ---
  drawRoundedRectPath(ctx, x, y, w, h, r, isH5) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
  // --- 文字换行 ---
  wrapTextH5(ctx, text, x, y, maxWidth, lineHeight) {
    const chars = text.split("");
    let line = "";
    let currentY = y;
    for (let i = 0; i < chars.length; i++) {
      const testLine = line + chars[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line.length > 0) {
        ctx.fillText(line, x, currentY);
        line = chars[i];
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  }
  wrapTextMP(ctx, text, x, y, maxWidth, lineHeight, fontSize) {
    const charWidth = fontSize;
    const maxCharsPerLine = Math.floor(maxWidth / charWidth);
    let line = "";
    let currentY = y;
    for (let i = 0; i < text.length; i++) {
      line += text[i];
      if (line.length >= maxCharsPerLine) {
        ctx.fillText(line, x, currentY);
        line = "";
        currentY += lineHeight;
      }
    }
    if (line)
      ctx.fillText(line, x, currentY);
  }
  // --- 图片加载 ---
  loadImageH5(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => {
        const img2 = new Image();
        img2.onload = () => resolve(img2);
        img2.onerror = () => {
          console.warn("[poster-renderer] \u56FE\u7247\u52A0\u8F7D\u5931\u8D25:", src);
          resolve(null);
        };
        img2.src = src;
      };
      img.src = src;
    });
  }
  downloadImageMP(url) {
    return new Promise((resolve) => {
      const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
      uni.downloadFile({
        url: fullUrl,
        success: (res) => {
          if (res.statusCode === 200)
            resolve(res.tempFilePath);
          else
            resolve(null);
        },
        fail: () => resolve(null)
      });
    });
  }
  // --- 圆形头像 ---
  drawCircularImageH5(ctx, img, x, y, size) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
  }
  drawCircularImageMP(ctx, imgPath, x, y, size) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(imgPath, x, y, size, size);
    ctx.restore();
  }
  // --- 渐变色解析 ---
  /**
   * 解析 #gradient:from,to 格式的颜色字符串
   * 返回 [from, to] 或 null（非渐变色）
   */
  parseGradientColor(color) {
    if (!color)
      return null;
    if (color.startsWith("#gradient:")) {
      const parts = color.substring(10).split(",");
      if (parts.length >= 2)
        return parts.map((p) => p.startsWith("#") ? p : `#${p}`);
    }
    return null;
  }
}
export {
  PosterRenderer
};
