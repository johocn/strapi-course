function baseElement(overrides) {
  return {
    elementKey: "",
    elementType: "text",
    isVariable: false,
    variableName: "",
    content: "",
    defaultValue: "",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    zIndex: 10,
    rotation: 0,
    opacity: 1,
    fontSize: 14,
    fontColor: "#333333",
    fontWeight: "normal",
    fontFamily: "sans-serif",
    textAlign: "left",
    lineHeight: 1.5,
    letterSpacing: 0,
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "#eeeeee",
    imageFit: "cover",
    qrContentMode: "direct",
    qrInviteParam: "inviteCode",
    qrInviteSeparator: "?",
    qrFallbackMode: "base_url_only",
    qrErrorLevel: "M",
    qrSize: 120,
    qrColor: "#000000",
    qrBgColor: "#FFFFFF",
    shapeType: "rect",
    sortOrder: 0,
    ...overrides
  };
}
const brandShareTemplate = {
  code: "brand_share",
  name: "\u4F01\u4E1A\u54C1\u724C\u6D77\u62A5",
  canvasWidth: 600,
  canvasHeight: 1e3,
  backgroundColor: "#FFFFFF",
  backgroundMode: "cover",
  requiredVariables: ["title", "values", "main_image", "qr_code"],
  optionalVariables: ["logo", "invite_code"],
  elements: [
    baseElement({
      elementKey: "gradient_bar",
      elementType: "shape",
      shapeType: "rect",
      x: 0,
      y: 0,
      width: 600,
      height: 6,
      zIndex: 1,
      sortOrder: 1,
      shapeGradient: { from: "#667eea", to: "#764ba2" }
    }),
    baseElement({
      elementKey: "logo",
      elementType: "image",
      isVariable: true,
      variableName: "logo",
      defaultValue: "",
      x: 510,
      y: 40,
      width: 60,
      height: 60,
      imageFit: "contain",
      zIndex: 10,
      sortOrder: 2
    }),
    baseElement({
      elementKey: "title",
      elementType: "text",
      isVariable: true,
      variableName: "title",
      defaultValue: "\u5B66\u4E60\u5E73\u53F0",
      x: 30,
      y: 120,
      width: 540,
      height: 50,
      fontSize: 36,
      fontColor: "#333333",
      fontWeight: "bold",
      textAlign: "center",
      zIndex: 10,
      sortOrder: 3
    }),
    baseElement({
      elementKey: "values",
      elementType: "text",
      isVariable: true,
      variableName: "values",
      defaultValue: "\u5B66\u4E60\u8BFE\u7A0B\uFF0C\u7B54\u9898\u8D62\u79EF\u5206",
      x: 30,
      y: 185,
      width: 540,
      height: 80,
      fontSize: 26,
      fontColor: "#666666",
      textAlign: "center",
      lineHeight: 1.6,
      zIndex: 10,
      sortOrder: 4
    }),
    baseElement({
      elementKey: "main_image",
      elementType: "image",
      isVariable: true,
      variableName: "main_image",
      defaultValue: "",
      x: 30,
      y: 290,
      width: 540,
      height: 300,
      imageFit: "cover",
      borderRadius: 12,
      zIndex: 5,
      sortOrder: 5
    }),
    baseElement({
      elementKey: "qr_code",
      elementType: "qrcode",
      isVariable: false,
      qrContentMode: "url_with_invite",
      qrInviteParam: "inviteCode",
      qrFallbackMode: "base_url_only",
      x: 200,
      y: 640,
      width: 200,
      height: 200,
      qrSize: 200,
      zIndex: 10,
      sortOrder: 6
    }),
    baseElement({
      elementKey: "footer_text",
      elementType: "text",
      isVariable: false,
      content: "\u626B\u7801\u7ACB\u5373\u4F53\u9A8C",
      x: 30,
      y: 870,
      width: 540,
      height: 30,
      fontSize: 24,
      fontColor: "#999999",
      textAlign: "center",
      zIndex: 10,
      sortOrder: 7
    })
  ]
};
const courseShareTemplate = {
  code: "course_share",
  name: "\u8BFE\u7A0B\u63A8\u8350\u6D77\u62A5",
  canvasWidth: 600,
  canvasHeight: 1e3,
  backgroundColor: "#FFFFFF",
  backgroundMode: "cover",
  requiredVariables: ["user_name", "course_image", "qr_code"],
  optionalVariables: ["user_avatar", "recommend_reason", "invite_code"],
  elements: [
    baseElement({
      elementKey: "gradient_bar",
      elementType: "shape",
      shapeType: "rect",
      x: 0,
      y: 0,
      width: 600,
      height: 6,
      zIndex: 1,
      sortOrder: 1,
      shapeGradient: { from: "#667eea", to: "#764ba2" }
    }),
    baseElement({
      elementKey: "user_avatar",
      elementType: "image",
      isVariable: true,
      variableName: "user_avatar",
      defaultValue: "",
      x: 30,
      y: 40,
      width: 50,
      height: 50,
      imageFit: "cover",
      borderRadius: 25,
      zIndex: 10,
      sortOrder: 2
    }),
    baseElement({
      elementKey: "user_name",
      elementType: "text",
      isVariable: true,
      variableName: "user_name",
      defaultValue: "\u597D\u53CB\u63A8\u8350",
      x: 90,
      y: 55,
      width: 300,
      height: 30,
      fontSize: 24,
      fontColor: "#333333",
      fontWeight: "bold",
      textAlign: "left",
      zIndex: 10,
      sortOrder: 3
    }),
    baseElement({
      elementKey: "course_image",
      elementType: "image",
      isVariable: true,
      variableName: "course_image",
      defaultValue: "",
      x: 30,
      y: 120,
      width: 540,
      height: 280,
      imageFit: "cover",
      borderRadius: 12,
      zIndex: 5,
      sortOrder: 4
    }),
    baseElement({
      elementKey: "recommend_reason",
      elementType: "text",
      isVariable: true,
      variableName: "recommend_reason",
      defaultValue: "\u8FD9\u95E8\u8BFE\u7A0B\u5F88\u68D2\uFF0C\u63A8\u8350\u7ED9\u4F60",
      x: 30,
      y: 430,
      width: 540,
      height: 100,
      fontSize: 26,
      fontColor: "#555555",
      textAlign: "left",
      lineHeight: 1.6,
      zIndex: 10,
      sortOrder: 5
    }),
    baseElement({
      elementKey: "qr_code",
      elementType: "qrcode",
      isVariable: false,
      qrContentMode: "url_with_invite",
      qrInviteParam: "inviteCode",
      qrFallbackMode: "base_url_only",
      x: 200,
      y: 580,
      width: 200,
      height: 200,
      qrSize: 200,
      zIndex: 10,
      sortOrder: 6
    }),
    baseElement({
      elementKey: "footer_text",
      elementType: "text",
      isVariable: false,
      content: "\u626B\u7801\u4E00\u8D77\u5B66\u4E60",
      x: 30,
      y: 810,
      width: 540,
      height: 30,
      fontSize: 24,
      fontColor: "#999999",
      textAlign: "center",
      zIndex: 10,
      sortOrder: 7
    })
  ]
};
const productShareTemplate = {
  code: "product_share",
  name: "\u79EF\u5206\u5151\u6362\u6D77\u62A5",
  canvasWidth: 600,
  canvasHeight: 1e3,
  backgroundColor: "#FFFFFF",
  backgroundMode: "cover",
  requiredVariables: ["user_name", "product_image", "product_name", "product_price", "qr_code"],
  optionalVariables: ["user_avatar", "recommend_reason", "invite_code"],
  elements: [
    baseElement({
      elementKey: "gradient_bar",
      elementType: "shape",
      shapeType: "rect",
      x: 0,
      y: 0,
      width: 600,
      height: 6,
      zIndex: 1,
      sortOrder: 1,
      shapeGradient: { from: "#667eea", to: "#764ba2" }
    }),
    baseElement({
      elementKey: "user_avatar",
      elementType: "image",
      isVariable: true,
      variableName: "user_avatar",
      defaultValue: "",
      x: 30,
      y: 40,
      width: 50,
      height: 50,
      imageFit: "cover",
      borderRadius: 25,
      zIndex: 10,
      sortOrder: 2
    }),
    baseElement({
      elementKey: "user_name",
      elementType: "text",
      isVariable: true,
      variableName: "user_name",
      defaultValue: "\u597D\u53CB",
      x: 90,
      y: 55,
      width: 300,
      height: 30,
      fontSize: 24,
      fontColor: "#333333",
      fontWeight: "bold",
      textAlign: "left",
      zIndex: 10,
      sortOrder: 3
    }),
    // 积分兑换徽章（橙色背景白字，叠加在商品图片左上角）
    baseElement({
      elementKey: "exchange_badge",
      elementType: "text",
      isVariable: false,
      content: "\u79EF\u5206\u5151\u6362",
      x: 30,
      y: 130,
      width: 110,
      height: 32,
      fontSize: 14,
      fontColor: "#FFFFFF",
      fontWeight: "bold",
      textAlign: "center",
      elementBgColor: "#FF6B00",
      borderRadius: 4,
      zIndex: 20,
      sortOrder: 4
    }),
    baseElement({
      elementKey: "product_image",
      elementType: "image",
      isVariable: true,
      variableName: "product_image",
      defaultValue: "",
      x: 30,
      y: 120,
      width: 540,
      height: 260,
      imageFit: "cover",
      borderRadius: 12,
      zIndex: 5,
      sortOrder: 5
    }),
    baseElement({
      elementKey: "product_name",
      elementType: "text",
      isVariable: true,
      variableName: "product_name",
      defaultValue: "\u7CBE\u54C1\u5546\u54C1",
      x: 30,
      y: 410,
      width: 540,
      height: 40,
      fontSize: 32,
      fontColor: "#333333",
      fontWeight: "bold",
      textAlign: "left",
      zIndex: 10,
      sortOrder: 6
    }),
    baseElement({
      elementKey: "product_price",
      elementType: "text",
      isVariable: true,
      variableName: "product_price",
      defaultValue: "0 \u79EF\u5206",
      x: 30,
      y: 465,
      width: 300,
      height: 35,
      fontSize: 28,
      fontColor: "#FF4444",
      fontWeight: "bold",
      textAlign: "left",
      zIndex: 10,
      sortOrder: 7
    }),
    baseElement({
      elementKey: "recommend_reason",
      elementType: "text",
      isVariable: true,
      variableName: "recommend_reason",
      defaultValue: "\u597D\u7269\u63A8\u8350\uFF0C\u5FEB\u6765\u5151\u6362",
      x: 30,
      y: 520,
      width: 540,
      height: 70,
      fontSize: 24,
      fontColor: "#555555",
      textAlign: "left",
      lineHeight: 1.6,
      zIndex: 10,
      sortOrder: 8
    }),
    baseElement({
      elementKey: "qr_code",
      elementType: "qrcode",
      isVariable: false,
      qrContentMode: "url_with_invite",
      qrInviteParam: "inviteCode",
      qrFallbackMode: "base_url_only",
      x: 210,
      y: 620,
      width: 180,
      height: 180,
      qrSize: 180,
      zIndex: 10,
      sortOrder: 9
    }),
    baseElement({
      elementKey: "footer_text",
      elementType: "text",
      isVariable: false,
      content: "\u626B\u7801\u79EF\u5206\u5151\u6362\u597D\u7269",
      x: 30,
      y: 830,
      width: 540,
      height: 30,
      fontSize: 24,
      fontColor: "#999999",
      textAlign: "center",
      zIndex: 10,
      sortOrder: 10
    })
  ]
};
const activityShareTemplate = {
  code: "activity_share",
  name: "\u6D3B\u52A8\u5206\u4EAB\u6D77\u62A5",
  canvasWidth: 600,
  canvasHeight: 1e3,
  backgroundColor: "#FFFFFF",
  backgroundMode: "cover",
  requiredVariables: ["title", "qr_code"],
  optionalVariables: ["activity_time", "activity_venue", "invite_code"],
  elements: [
    baseElement({
      elementKey: "gradient_bar",
      elementType: "shape",
      shapeType: "rect",
      x: 0,
      y: 0,
      width: 600,
      height: 6,
      zIndex: 1,
      sortOrder: 1,
      shapeGradient: { from: "#667eea", to: "#764ba2" }
    }),
    baseElement({
      elementKey: "title",
      elementType: "text",
      isVariable: true,
      variableName: "title",
      defaultValue: "\u7CBE\u54C1\u7EBF\u4E0B\u6D3B\u52A8",
      x: 30,
      y: 150,
      width: 540,
      height: 60,
      fontSize: 36,
      fontColor: "#333333",
      fontWeight: "bold",
      textAlign: "left",
      lineHeight: 1.4,
      zIndex: 10,
      sortOrder: 3
    }),
    baseElement({
      elementKey: "activity_time",
      elementType: "text",
      isVariable: true,
      variableName: "activity_time",
      defaultValue: "\u6D3B\u52A8\u65F6\u95F4 \u00B7 \u6B3C\u5B9A",
      x: 30,
      y: 240,
      width: 540,
      height: 40,
      fontSize: 26,
      fontColor: "#666666",
      textAlign: "left",
      zIndex: 10,
      sortOrder: 4
    }),
    baseElement({
      elementKey: "activity_venue",
      elementType: "text",
      isVariable: true,
      variableName: "activity_venue",
      defaultValue: "\u6D3B\u52A8\u573A\u6240 \u00B7 \u6B3C\u5B9A",
      x: 30,
      y: 295,
      width: 540,
      height: 40,
      fontSize: 26,
      fontColor: "#666666",
      textAlign: "left",
      zIndex: 10,
      sortOrder: 5
    }),
    baseElement({
      elementKey: "main_info_badge",
      elementType: "text",
      isVariable: false,
      content: "\u626B\u7801\u62A5\u540D",
      x: 225,
      y: 390,
      width: 150,
      height: 44,
      fontSize: 24,
      fontColor: "#FFFFFF",
      fontWeight: "bold",
      textAlign: "center",
      elementBgColor: "#667eea",
      borderRadius: 8,
      zIndex: 10,
      sortOrder: 6
    }),
    baseElement({
      elementKey: "qr_code",
      elementType: "qrcode",
      isVariable: false,
      qrContentMode: "url_with_invite",
      qrInviteParam: "inviteCode",
      qrInviteSeparator: "?",
      qrFallbackMode: "base_url_only",
      x: 200,
      y: 480,
      width: 200,
      height: 200,
      qrSize: 200,
      zIndex: 10,
      sortOrder: 7
    }),
    baseElement({
      elementKey: "footer_text",
      elementType: "text",
      isVariable: false,
      content: "\u540D\u989D\u6709\u9650 \u00B7 \u626B\u7801\u62A5\u540D\u53C2\u52A0",
      x: 30,
      y: 720,
      width: 540,
      height: 30,
      fontSize: 24,
      fontColor: "#999999",
      textAlign: "center",
      zIndex: 10,
      sortOrder: 8
    })
  ]
};
const BUILTIN_TEMPLATES = {
  brand_share: brandShareTemplate,
  course_share: courseShareTemplate,
  product_share: productShareTemplate,
  activity_share: activityShareTemplate
};
function resolveTemplateLocal(code, variables) {
  const template = BUILTIN_TEMPLATES[code] || BUILTIN_TEMPLATES["brand_share"];
  if (!template)
    return null;
  const sortedElements = [...template.elements].sort((a, b) => {
    if (a.zIndex !== b.zIndex)
      return a.zIndex - b.zIndex;
    return a.sortOrder - b.sortOrder;
  });
  const resolvedElements = sortedElements.map((element) => {
    const resolved = { ...element };
    if (element.isVariable && element.variableName) {
      if (element.variableName === "invite_code" && !variables.invite_code) {
        resolved.resolvedContent = element.defaultValue || "";
      } else {
        // 传入变量值优先，defaultValue 兜底
        resolved.resolvedContent = variables[element.variableName] || element.defaultValue || "";
      }
    } else {
      resolved.resolvedContent = element.content || "";
    }
    if (element.elementType === "qrcode" && element.qrContentMode === "url_with_invite") {
      const baseUrl = variables.qr_code || element.qrBaseUrl || "";
      const inviteCode = variables.invite_code;
      if (inviteCode) {
        const separator = element.qrInviteSeparator || "?";
        const param = element.qrInviteParam || "inviteCode";
        resolved.resolvedContent = `${baseUrl}${separator}${param}=${inviteCode}`;
      } else {
        const fallback = element.qrFallbackMode || "base_url_only";
        if (fallback === "base_url_only") {
          resolved.resolvedContent = baseUrl;
        } else if (fallback === "default_value") {
          resolved.resolvedContent = element.defaultValue || baseUrl;
        } else if (fallback === "hide_element") {
          resolved.hidden = true;
        }
      }
    }
    return resolved;
  }).filter((e) => !e.hidden);
  return {
    template: {
      canvasWidth: template.canvasWidth,
      canvasHeight: template.canvasHeight,
      backgroundColor: template.backgroundColor,
      backgroundImage: template.backgroundImage,
      backgroundMode: template.backgroundMode
    },
    elements: resolvedElements
  };
}
export {
  BUILTIN_TEMPLATES,
  resolveTemplateLocal
};
