const host = "http://16.16.168.124/";
const videoIdPattern = /(?<=v=)[a-zA-Z0-9_-]+/;
const notInterestedTextMarkers = [
  "Not interested",
  "Не цікавить",
  "Не интересует",
];
const cache = new Map();
var canPerformBackendRequest = true;
var canTriggerBlock = true;

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

async function getSettings() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "getSettings" }, function (response) {
      if (response.error) {
        reject(response.error);
      } else {
        resolve(response.data);
      }
    });
  });
}

async function canBeShowed(currentValue) {
  const data = await getSettings();
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

async function canBeBlocked(currentValue) {
  const data = await getSettings();
  let checkboxValue = data["checkbox2"];
  let thresholdValue = data["threshold2"];

  console.debug(
    `RuBlocker: checkbox1:${checkboxValue} threshold1:${thresholdValue} currentValue:${currentValue}`
  );

  var result = true;
  if (checkboxValue === undefined || thresholdValue === undefined) {
    result = false;
  } else if (checkboxValue === false) {
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
    clearInjection(element);
  }
}

function isOnScreen(element) {
  const bounds = element.getBoundingClientRect();
  return bounds.top < window.innerHeight && bounds.bottom > 0;
}

async function processAutoBlock(element, data) {
  // ask background for settings
  if (!(await canBeBlocked(data.ru))) return;

  // find menu
  let parent = element.closest(`ytd-compact-video-renderer`);
  if (parent == null) return;

  // verify dismissed block, maybe video is already blocked
  let dismissedBlock = parent.querySelector(`#dismissed`);
  if (dismissedBlock.innerHTML.trim().length !== 0) return;

  // lets find the button with 3 dots (vertical ellipsis)
  let menuOpenButton = parent.querySelector(
    "ytd-menu-renderer.ytd-compact-video-renderer yt-icon-button.dropdown-trigger #button"
  );
  if (menuOpenButton == null || !isOnScreen(menuOpenButton)) return;

  canTriggerBlock = false;
  menuOpenButton.click();
  console.debug("RuBlocker: auto-block menu click");

  setTimeout(function () {
    // get all popup elements
    let possibleMenuItems = [
      ...document.querySelectorAll("ytd-menu-service-item-renderer"),
    ];
    // try to find button by text content
    let notInterestedButton = possibleMenuItems.find((el) =>
      notInterestedTextMarkers.some((s) => el.textContent.includes(s))
    );
    // try to find button by icon
    if (!notInterestedButton) {
      notInterestedButton = possibleMenuItems.find(
        (el) => el.querySelector('svg g path[d*="M18.71"]') !== null
      );
    }

    if (notInterestedButton) {
      notInterestedButton.click();
      console.debug("RuBlocker: auto-block menu item click");
    }
  }, 3);
}

async function processShow(element, youtubeLink) {
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
      if (canTriggerBlock) {
        await processAutoBlock(element, data);
      }
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
  canPerformBackendRequest = true;
  canTriggerBlock = true;

  let settings = await getSettings();
  if (settings["checkbox1"] === true || settings["checkbox2"] === true) {
    // show injection for main video
    let element = document.querySelector("#cinematics.ytd-watch-flexy");
    if (element != null) {
      await processShow(element, window.location.href);
    }

    // show injection for child videos
    let targets = document.querySelectorAll(
      ".yt-simple-endpoint.ytd-thumbnail[href]"
    );
    for (i = 0; i < targets.length; i++) {
      let element = targets[i];
      await processShow(element, element.href);
    }
  }
}, 10000);
