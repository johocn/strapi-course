import { BASE_API } from "./env";
async function getAdZone(position) {
  try {
    const res = await uni.request({
      url: `${BASE_API}/zhao-studio/v1/ads/zones/${position}`,
      method: "GET"
    });
    const data = res.data?.data;
    return data || { zone: null, contents: [] };
  } catch (e) {
    console.error("[ad-api] getAdZone error:", e);
    return { zone: null, contents: [] };
  }
}
async function getAllAdZones(site) {
  try {
    let url = `${BASE_API}/zhao-studio/v1/ads/zones`;
    if (site) {
      url += `?site=${encodeURIComponent(site)}`;
    }
    const res = await uni.request({
      url,
      method: "GET"
    });
    const data = res.data?.data;
    return Array.isArray(data) ? data : data?.zones || [];
  } catch (e) {
    console.error("[ad-api] getAllAdZones error:", e);
    return [];
  }
}
async function renderPoster(templateCode, variables) {
  try {
    const res = await uni.request({
      url: `${BASE_API}/zhao-studio/v1/posters/render`,
      method: "POST",
      header: { "Content-Type": "application/json" },
      data: JSON.stringify({ templateCode, variables })
    });
    const data = res.data?.data;
    return data || null;
  } catch (e) {
    console.error("[ad-api] renderPoster error:", e);
    return null;
  }
}
async function getPosterTemplate(code) {
  try {
    const res = await uni.request({
      url: `${BASE_API}/zhao-studio/v1/posters/templates/${code}`,
      method: "GET"
    });
    const data = res.data?.data;
    return data || null;
  } catch (e) {
    console.error("[ad-api] getPosterTemplate error:", e);
    return null;
  }
}
export {
  getAdZone,
  getAllAdZones,
  getPosterTemplate,
  renderPoster
};
