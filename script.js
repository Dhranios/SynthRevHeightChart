const chart = document.getElementById('chart');
let parsedEntries = [];
let serverCharts = [];
let parsedOwners = [];
let ownersEntries = [];
let processingFiles = [
  "entries.json"
]
let processedFiles = []
canFilter = false;
let ownerFilter = []
let maxHeight = 70;
let nextElementX = 0;

let HeightMeters = false;

const HeightButton = document.getElementById("HeightButton");

HeightButton.addEventListener("click", () => {
  HeightMeters = !HeightMeters;

  HeightButton.textContent = HeightMeters ? "Height display: Meters" : "Height display: Feet";

  if (canFilter) {
    ChangeHeightDisplay()
  }
});

window.addEventListener("hashchange", () => {
  if (canFilter) {
    updateParams();
  }
});
function updateParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("server")) {
    let exists = false;
    serverCharts.forEach(chartEntry => {
      if (chartEntry.GetID() == params.get("server")) {
        exists = true;
      }
    });
    if (exists) {
      serverSelector.value = params.get("server");
      serverSelector.style.display = "none";
    }
    else {
      serverSelector.style.display = "block";
      serverSelector.selectedIndex = 0;
    }
  }
  else {
    serverSelector.style.display = "block";
    serverSelector.selectedIndex = 0;
  }
  setChart(serverSelector.value);
}

const serverSelector = document.getElementById("serverSelector");
const ownerSelector = document.getElementById("ownerSelector");

serverSelector.addEventListener("change", (e) => {
  if (canFilter) {
    setChart(e.target.value);
  }
});
ownerSelector.addEventListener("change", (e) => {
  if (canFilter) {
    if (ownerSelector.selectedIndex != 0) {
      setFilter([e.target.value]);
    } 
    else {
      setChart(serverSelector.value);
    }
  }
});

// Get all charts
fetch("entries.json").then(response => response.json()).then(data => {
  data.charts.forEach(c => {
    //Get all individual charts' data
    processingFiles.push("entries/" + c + ".json");
    fetch("entries/" + c + ".json").then(response => response.json()).then(chartdata => {
      console.log("Parsing chart:", c);
      const chartEntry = new Chart(c, chartdata.chart ?? c, chartdata.owners);
      serverCharts.push(chartEntry);
      chartdata.owners.forEach(o => {
        //If owner was not previously found, get all owner's entries
        if (!parsedOwners.includes(o)) {
          parsedOwners.push(o);
          processingFiles.push("entries/" + o + "/entries.json");
          fetch("entries/" + o + "/entries.json").then(response => response.json()).then(ownerdata => {
            console.log("Parsing owner:", o);
            const ownerEntry = new Owner(o, ownerdata.owner_name);
            ownersEntries.push(ownerEntry);
            ownerdata.entries.forEach(e => {
              const entry = new Entry(
                o,
                ownerdata.owner_name,
                e.name,
                e.height,
                e.art,
                e.align_bottom,
                e.align_top
              );
              parsedEntries.push(entry);
            });
            console.log("Parsed owner:", o);
            processedFiles.push("entries/" + o + "/entries.json");
          });
        }
      });
      console.log("Parsed chart:", c);
      processedFiles.push("entries/" + c + ".json");
    });
    processedFiles.push("entries.json");
  });
});
function waitUntilProcessed(processingFiles, processedFiles) {
  return new Promise(resolve => {
    const interval = setInterval(() => {
      const allDone = processingFiles.every(file =>
        processedFiles.includes(file)
      );

      if (allDone) {
        clearInterval(interval);
        resolve();
      }
    }, 50); // check every 50ms
  });
}
function waitForImage(img) {
  if (img.decode) {
    return img.decode().catch(() => {});
  }
  return new Promise(resolve => {
    if (img.complete) resolve();
    else img.onload = img.onerror = () => resolve();
  });
}
//When all files are loaded and processed, set positions
async function continueProcessing() {
  await waitUntilProcessed(processingFiles, processedFiles);
  //When all images are loaded to memory, set positions
  Promise.all(parsedEntries.map(entry => waitForImage(entry.img))).then(() => {
    serverCharts.forEach(c => {
      c.ownerIDs.forEach(o => {
        ownersEntries.forEach(OwnerEntry => {
          if (OwnerEntry.GetID() == o) {
            c.AddOwner(OwnerEntry);
          }
        });
      });
    });
    //Sort all entries from tallest to shortest
    parsedEntries.sort((a, b) => {
      if (b.heightCm == a.heightCm) {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      else {
        return b.heightCm - a.heightCm;
      }
    });
    serverCharts.sort((a, b) =>
      a.GetID().localeCompare(b.GetID(), undefined, { sensitivity: 'base' })
    );
    serverCharts.forEach(chartEntry => {
      const serverSelectorOption = document.createElement("option");
      serverSelectorOption.value = chartEntry.GetID();
      serverSelectorOption.textContent = chartEntry.GetName();
      serverSelector.appendChild(serverSelectorOption);
    });
    canFilter = true;
    updateParams();
    layout();
  });
}
continueProcessing();
function layout() {
  console.log("Layout updating");
  let maxAlignBottom = 0;
  maxHeight = 70;
  parsedEntries.forEach(entry => {
    if (!entry.hidden) {
      maxHeight = Math.max(maxHeight, entry.heightCm + entry.alignTop + 54); //54 for the text
      maxAlignBottom = Math.max(maxAlignBottom, entry.alignBottom);
    }
  });
  console.log("height: " + maxHeight + ", align: " + maxAlignBottom);
  chart.style.height = `${maxHeight + maxAlignBottom}px`;
  chart.innerHTML = "";
  nextElementX = 0;
  parsedEntries.forEach(entry => {
    if (!entry.hidden) {
      entry.render(chart);
      entry.element.style.top = `${maxHeight - entry.heightCm - entry.alignTop - 54}px`; //54 for the text
      entry.element.style.left = `${nextElementX}px`;
      nextElementX += entry.element.offsetWidth + 5;
    }
  });
  let floor = document.createElement('div');
  floor.className = 'floor';
  floor.style.height = `${maxAlignBottom}px`;
  floor.style.width = `${nextElementX}px`;
  floor.style.top = `${maxHeight}px`;
  chart.appendChild(floor);
  ChangeHeightDisplay();
};

function ChangeHeightDisplay() {
  chart.querySelectorAll(".height-line").forEach(el => {
    el.remove();
  });
  let y = maxHeight;
  while (y > 0) {
    if (HeightMeters) {
      y -= 100;
    }
    else {
      y -= 30.48;
    }
    let heightLine = document.createElement('div');
    heightLine.className = 'height-line';
    heightLine.style.height = `2px`;
    heightLine.style.width = `${nextElementX}px`;
    heightLine.style.top = `${y}px`;
    chart.appendChild(heightLine);
  }
}

function setChart(serverChart) {
  console.log("Selected chart: " + serverChart);
  let selectedChart;
  serverCharts.forEach(chartEntry => {
    if (chartEntry.GetID() == serverChart) {
      selectedChart = chartEntry;
    }
  });
  document.title = selectedChart.GetName() + " Height Chart"
  ownerSelector.selectedIndex = 0;
  while (ownerSelector.childElementCount > 1) {
    ownerSelector.removeChild(ownerSelector.lastChild);
  }
  selectedChart.GetOwners().forEach(o => {
    const ownerSelectorOption = document.createElement("option");
    ownerSelectorOption.value = o.GetID();
    ownerSelectorOption.textContent = o.GetName();
    ownerSelector.appendChild(ownerSelectorOption);
  });
  let ownerFilter = []
  selectedChart.GetOwners().forEach(o => {
    ownerFilter.push(o.GetID());
  });
  setFilter(ownerFilter);
}
function setFilter(owners) {
  console.log("Selected owners: " + owners);
  parsedEntries.forEach(entry => {
    entry.updateVisibility(owners, owners.length == 1)
  });
  layout();
}

class Chart {
  constructor(id, name, owners) {
    this.id = id;
    this.name = name;
    this.ownerIDs = owners;
    this.owners = [];
  }
  AddOwner(owner) {
    return this.owners.push(owner);
  }
  GetName() {
    return this.name;
  }
  GetOwners() {
    return this.owners;
  }
  GetID() {
    return this.id;
  }
}

class Owner {
  constructor(id, name) {
    this.id = id;
    this.name = name ?? id;
  }
  GetName() {
    return this.name;
  }
  GetID() {
    return this.id;
  }
}


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

    if (height.includes("'")) {
      const temp = height.slice(0, -2).split("'");
      this.heightCm = parseFloat(temp[0]) * 30.48 + parseFloat(temp[1]) * 2.54;
    } else {
      this.heightCm = parseFloat(height);
    }

    // fallback if image fails
    this.img.onerror = () => {
      this.img.src = 'entries/missingno.png';
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

  updateText(showOwner = true) {
    if (showOwner) {
      this.titleEl.textContent = `${this.name} (${this.owner})`;
    } else {
      this.titleEl.textContent = this.name;
    }

    this.ftEl.textContent = "ft: " + this.getHeightIn("ft");
    this.cmEl.textContent = "cm: " + this.getHeightIn("cm");
  }

  updateVisibility(ownerFilter, singleOwner) {
    if (ownerFilter.includes(this.ownerKey)) {
      this.hidden = false;
      this.element.style.display = "block";
      this.updateText(!singleOwner);
      return true;
    }

    this.hidden = true;
    this.element.style.display = "none";
    return false;
  }

  render(container) {
    if (!this.hidden) {
      this.element.style.display = "block";
      container.appendChild(this.element);
    }
  }
}