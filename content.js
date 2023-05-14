//const host = "http://127.0.0.1:5000/";
const host = "https://da72-195-3-128-14.ngrok-free.app/";
const videoIdPattern = /(?<=v=)[a-zA-Z0-9_-]+/;
const cache = new Map();
var canPerformBackendRequest = true;

async function backendRequest(videoId) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: "makeRequest", url: host + "ru/identify/" + videoId },
      function (response) {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response.data);
        }
      }
    );
  });
}

async function getShowThreshold() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: "getShowThreshold" },
      function (response) {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response.data);
        }
      }
    );
  });
}

async function canBeShowed(currentValue) {
  const data = await getShowThreshold();
  let checkboxValue = data["checkbox1"];
  let thresholdValue = data["threshold1"];

  console.debug(
    `RuBlocker: checkbox1:${checkboxValue} threshold1:${thresholdValue} currentValue:${currentValue}`
  );

  var result = true;
  if (checkboxValue === false) {
    result = false;
  } else if (thresholdValue !== undefined) {
    if (thresholdValue > currentValue * 100) {
      result = false;
    }
  }

  console.debug(`RuBlocker: canBeShowed returned ${result}`);
  return result;
}

function extractYoutubeId(youtubeLink) {
  let matches = youtubeLink.match(videoIdPattern);
  if (matches == null || matches.length < 1) {
    // stop notify about stories case
    if (!youtubeLink.includes("shorts"))
      console.debug(`RuBlocker: failed to parse youtube_id: ${youtubeLink}`);
    return null;
  }
  return matches[0];
}

async function cachedBackendRequest(videoId) {
  if (cache.has(videoId)) return cache.get(videoId);
  if (canPerformBackendRequest) return await backendRequest(videoId);
  return {};
}

function clearInjection(parentElement) {
  let injection = parentElement.querySelector("span#ru-blocker-span");
  if (injection !== null) {
    injection.innerHTML = "";
  }
}

async function updateInjectedValue(element, data) {
  // ask background for settings
  let canBeShowedResult = await canBeShowed(data.ru);

  // verify if injectable exists
  let injectable = element.querySelector(`span#ru-blocker-span`);

  if (canBeShowedResult) {
    if (injectable === null) {
      element.insertAdjacentHTML(
        "afterbegin",
        `<span id="ru-blocker-span" style="
          position: absolute;
          font-size: 40px;
          font-weight: bold;
          color: red;
          z-index: 1000;
          text-shadow: -1px 0 white, 0 1px white, 1px 0 white, 0 -1px white;
          ">РУСНЯ ${(data.ru * 100).toFixed(2)}%</span>`
      );
    } else {
      injectable.innerHTML = `РУСНЯ ${(data.ru * 100).toFixed(2)}%`;
    }
  } else {
    clearInjection(element)
  }
}

async function processElement(element, youtubeLink) {
  const videoId = extractYoutubeId(youtubeLink);
  if (videoId == null) {
    clearInjection(element);
    return;
  }

  try {
    const data = await cachedBackendRequest(videoId);
    if (data.ru !== undefined) {
      console.debug(
        `RuBlocker: ${videoId} ru:${data.ru} uk:${data.uk} en:${data.en}`
      );
      cache.set(videoId, data);
      await updateInjectedValue(element, data);
      return;
    } else if (data.state === "FAIL") {
      cache.set(videoId, data);
    } else if (data.queue_size !== undefined) {
      console.debug("RuBlocker: waiting for queue: " + data.queue_size);
      if (data.queue_size >= 8) canPerformBackendRequest = false;
    }
  } catch (error) {
    console.warn("RuBlocker: Failed: " + error);
  }
  clearInjection(element);
}

setInterval(async function () {
  let targets = document.querySelectorAll(
    ".yt-simple-endpoint.ytd-thumbnail[href]"
  );
  /* #cinematics.ytd-watch-flexy */

  canPerformBackendRequest = true;
  let element = document.querySelector("#cinematics.ytd-watch-flexy");
  if (element != null) {
    await processElement(element, window.location.href);
  }
  for (i = 0; i < targets.length; i++) {
    let element = targets[i];
    await processElement(element, element.href);
  }
}, 5000);
