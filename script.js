const chart = document.getElementById('chart');
let parsedEntries = [];
fetch('entries.json')
  .then(response => response.json())
  .then(data => {
    document.title = data.chart + " Height Chart";
    data.entries.forEach(e => {
      const entry = new Entry(
        e.owner,
        e.owner_name,
        e.name,
        e.height,
        e.art,
        e.align_bottom,
        e.align_top
      );
      parsedEntries.push(entry);
    });
    parsedEntries.sort((a, b) => {
      return b.heightCm - a.heightCm;
    });
    const imagePromises = parsedEntries.map(entry =>
      waitForImage(entry.img)
    );
    Promise.all(imagePromises).then(() => {
      layout();
    });
});
function waitForImage(img) {
  if (img.decode) {
    return img.decode().catch(() => {});
  }

  return new Promise(resolve => {
    if (img.complete) resolve();
    else img.onload = img.onerror = () => resolve();
  });
}
function layout() {
  let maxAlignBottom = 0;
  let maxHeight = 0; //floor height
  parsedEntries.forEach(entry => {
    maxHeight = Math.max(maxHeight, entry.heightCm + entry.alignTop);
    maxAlignBottom = Math.max(maxAlignBottom, entry.alignBottom);
  });
  const worldHeight = maxHeight + maxAlignBottom;
  chart.style.height = `${worldHeight}px`;
  chart.innerHTML = "";
  let x = 0;
  parsedEntries.forEach(entry => {
    entry.render(chart);
    entry.element.style.top = `${maxHeight - entry.heightCm - entry.alignTop + 10}px`; //10 px offset for some reason...
    entry.element.style.left = `${x}px`;
    x += entry.element.offsetWidth + 5;
  });
  let floor = document.createElement('div');
  floor.className = 'floor';
  floor.style.height = `${maxAlignBottom}px`;
  floor.style.width = `${x}px`;
  floor.style.top = `${maxHeight+maxAlignBottom/2}px`;
  chart.appendChild(floor);
  console.log(maxAlignBottom);
  let y = maxHeight+maxAlignBottom/2;
  while (y > 0) {
    y -= 30.48; //100 for cm
    let heightLine = document.createElement('div');
    heightLine.className = 'height-line';
    heightLine.style.height = `2px`;
    heightLine.style.width = `${x}px`;
    heightLine.style.top = `${y}px`;
    chart.appendChild(heightLine);
  }
};

class Entry {
  constructor(owner, ownerDisplay, name, height, art, alignBottom, alignTop) {
    this.hidden = false;

    this.owner = ownerDisplay ?? owner;;
    this.ownerKey = owner;
    this.name = name;

    this.alignBottom = alignBottom;
    this.alignTop = alignTop;

    this.artPath = `entries/${owner}/${art}.png`;

    // Create DOM elements
    this.element = document.createElement('div');
    this.element.className = 'entry';

    this.img = document.createElement('img');
    this.img.src = this.artPath;
    this.textWrapper = document.createElement('div');
    this.textWrapper.className = 'text-wrapper';
    this.heightWrapper = document.createElement('div');
    this.imageWrapper = document.createElement('div');
    this.imageWrapper.className = 'image-wrapper';

    // Parse height
    if (height.includes("'")) {
      const temp = height.slice(0, -2).split("'");
      this.heightCm = parseFloat(temp[0]) * 30.48 + parseFloat(temp[1]) * 2.54;
    } else {
      this.heightCm = parseFloat(height);
    }

    // fallback if image fails
    this.img.onerror = () => {
      this.img.src = 'entries/missing.png';
      this.alignBottom = 0;
      this.alignTop = 0;
    };
    this.img.onload = () => {
      const naturalHeight = this.img.naturalHeight;

      const characterHeight = naturalHeight - this.alignTop - this.alignBottom;

      const scale = this.heightCm / characterHeight;
      this.alignBottom = this.alignBottom * scale;
      this.alignTop = this.alignTop * scale;

      this.img.style.height = (naturalHeight * scale) + "px";
      //this.imageWrapper.style.transform = `translateY(${this.alignBottom * scale}px)`;
      //this.textWrapper.style.transform = `translateY(${this.alignBottom * scale}px)`;
    };

    this.titleEl = document.createElement('div');
    this.ftEl = document.createElement('div');
    this.cmEl = document.createElement('div');

    this.textWrapper.appendChild(this.titleEl);
    this.textWrapper.appendChild(this.heightWrapper);
    this.heightWrapper.appendChild(this.ftEl);
    this.heightWrapper.appendChild(this.cmEl);
    this.imageWrapper.appendChild(this.img);
    this.element.appendChild(this.textWrapper);
    this.element.appendChild(this.imageWrapper);

    this.updateText();
  }

  // ---- Height conversion ----
  getHeightIn(format) {
    if (format === "ft") {
      let inches = this.heightCm / 30.48;
      let ft = Math.floor(inches);
      inches = ((inches - ft) * 30.48) / 2.54;
      return `${ft}'${inches.toFixed(2)}''`;
    } else {
      return this.heightCm.toFixed(2);
    }
  }

  // ---- Update text ----
  updateText(showOwner = true) {
    if (showOwner) {
      this.titleEl.textContent = `${this.name} (${this.owner})`;
    } else {
      this.titleEl.textContent = this.name;
    }

    this.ftEl.textContent = "ft: " + this.getHeightIn("ft");
    this.cmEl.textContent = "cm: " + this.getHeightIn("cm");
  }

  // ---- Filtering (like is_owner) ----
  isOwner(ownerFilter, lightMode) {
    if (ownerFilter === "") {
      this.hidden = false;
      this.updateText(true);
      this.setTextColor(lightMode ? "dark" : "light");
      return true;
    }

    if (ownerFilter === this.owner) {
      this.hidden = false;
      this.updateText(false);
      this.setTextColor(lightMode ? "dark" : "light");
      return true;
    }

    this.hidden = true;
    this.element.style.display = "none";
    return false;
  }

  // ---- Text color ----
  setTextColor(type) {
    const color = type === "dark" ? "black" : "white";
    this.titleEl.style.color = color;
    this.ftEl.style.color = color;
    this.cmEl.style.color = color;
  }

  // ---- Positioning (replacement for rect.x) ----
  moveRight(amount) {
    this.element.style.position = "absolute";
    this.element.style.left = amount + "px";
  }

  // ---- Render (replacement for draw) ----
  render(container) {
    if (!this.hidden) {
      this.element.style.display = "block";
      container.appendChild(this.element);
    }
  }
}