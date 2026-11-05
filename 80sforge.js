const poster = document.querySelector(".poster");
const title = poster.querySelector(".title-word");
const layers = title.querySelectorAll(".title-depth, .title-edge, .title-face");
const face = title.querySelector(".title-face");
const tagline = poster.querySelector(".tagline");
const counter = poster.querySelector(".counter");
const form = document.querySelector(".controls");
const save = form.querySelector(".save");
const saveStatus = form.querySelector(".save-status");

const titleMax = 210;
const taglineMax = 110;
const titleRoom = 0.66;
const taglineRoom = 0.72;
const exportWidth = 1920;
const exportHeight = 1080;
let replayTimer;

const textWidth = (el) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect().width;
};

const fit = (text, sized, prop, max, room) => {
  sized.style.setProperty(prop, max);
  const width = textWidth(text);
  const available = poster.clientWidth * room;
  if (width > available) sized.style.setProperty(prop, (max * available / width).toFixed(1));
};

const describe = () => {
  poster.setAttribute(
    "aria-label",
    `An 80s chrome movie title reading ${form.title.value || "nothing"}, with the neon tagline ${form.tagline.value || "left blank"}, over a Miami night: a pink moon rising out of the ocean between palm trees`,
  );
};

const replayGlint = () => {
  clearTimeout(replayTimer);
  replayTimer = setTimeout(() => {
    for (const animation of title.getAnimations({ subtree: true })) animation.currentTime = 0;
  }, 350);
};

const fitAll = () => {
  fit(face, title, "--title-size", titleMax, titleRoom);
  fit(tagline, tagline, "--tagline-size", taglineMax, taglineRoom);
};

form.title.addEventListener("input", () => {
  for (const layer of layers) layer.textContent = form.title.value;
  fitAll();
  describe();
  replayGlint();
});

form.tagline.addEventListener("input", () => {
  tagline.textContent = form.tagline.value;
  fitAll();
  describe();
});

form.vhs.addEventListener("change", () => {
  poster.dataset.vhs = form.vhs.checked ? "on" : "off";
});

form.addEventListener("submit", (event) => event.preventDefault());

const started = Date.now();
const tick = () => {
  const seconds = Math.floor((Date.now() - started) / 1000);
  const mm = String(Math.floor(seconds / 60) % 60).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  counter.textContent = `${Math.floor(seconds / 3600)}:${mm}:${ss}`;
};
setInterval(tick, 1000);

const toDataUrl = async (url) => {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

const fontFaces = function* (rules) {
  for (const rule of rules) {
    if (rule instanceof CSSFontFaceRule) yield rule;
    else if (rule.cssRules) yield* fontFaces(rule.cssRules);
  }
};

const embeddedFonts = async () => {
  const sheet = [...document.styleSheets].find((s) => s.href?.endsWith("80sforge.css"));
  const faces = [...fontFaces(sheet.cssRules)];
  const css = await Promise.all(
    faces.map(async (rule) => {
      const url = rule.style.getPropertyValue("src").match(/url\("?([^")]+)"?\)/)[1];
      return rule.cssText.replace(/url\([^)]*\)/, `url("${await toDataUrl(url)}")`);
    }),
  );
  return css.join("\n");
};

const filename = () => {
  const slug = form.title.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "chrome-title"}.png`;
};

const renderPng = async () => {
  const [styles, fonts] = await Promise.all([fetch("80sforge.css").then((r) => r.text()), embeddedFonts()]);
  const clone = poster.cloneNode(true);
  clone.removeAttribute("role");
  clone.removeAttribute("aria-label");
  const markup = new XMLSerializer().serializeToString(clone);
  const sizing = `.poster { --poster-size: ${exportWidth}px; }`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${exportWidth}" height="${exportHeight}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style><![CDATA[${styles}\n${fonts}\n${sizing}]]></style>${markup}</div></foreignObject></svg>`;

  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = exportWidth;
  canvas.height = exportHeight;
  canvas.getContext("2d").drawImage(image, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("empty"))), "image/png"));
};

save.addEventListener("click", async () => {
  if (save.getAttribute("aria-disabled") === "true") return;
  save.setAttribute("aria-disabled", "true");
  saveStatus.textContent = "Rendering the image…";
  try {
    const blob = await renderPng();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename();
    link.click();
    URL.revokeObjectURL(link.href);
    saveStatus.textContent = `Saved ${link.download}.`;
  } catch {
    saveStatus.textContent = "This browser couldn't render the image. Try Chrome or Firefox.";
  } finally {
    save.removeAttribute("aria-disabled");
  }
});

document.fonts.ready.then(fitAll);
