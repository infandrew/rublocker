const DEFAULT_CHECKBOX1 = true;
const DEFAULT_CHECKBOX2 = true;
const DEFAULT_THRESHOLD1 = 50;
const DEFAULT_THRESHOLD2 = 95;

chrome.storage.sync.get(
  {
    checkbox1: DEFAULT_CHECKBOX1,
    threshold1: DEFAULT_THRESHOLD1,
    checkbox2: DEFAULT_CHECKBOX2,
    threshold2: DEFAULT_THRESHOLD2,
  },
  function (data) {
    console.debug(
      `RuBlocker: configuration init values:
      checkbox1:${data.checkbox1} threshold1:${data.threshold1}
      checkbox2:${data.checkbox2} threshold2:${data.threshold2}`
    );
    chrome.storage.sync.set(data);
  }
);

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "makeRequest") {
    fetch(request.url)
      .then((response) => response.json())
      .then((data) => {
        sendResponse({ data: data });
      })
      .catch((error) => {
        sendResponse({ error: error });
      });
  }
  if (request.action === "getSettings") {
    chrome.storage.sync.get(
      {
        checkbox1: DEFAULT_CHECKBOX1,
        threshold1: DEFAULT_THRESHOLD1,
        checkbox2: DEFAULT_CHECKBOX2,
        threshold2: DEFAULT_THRESHOLD2,
      },
      function (data) {
        sendResponse({ data: data });
      }
    );
  }
  return true;
});
