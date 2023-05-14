var checkbox1 = document.getElementById("checkbox1");
var checkbox2 = document.getElementById("checkbox2");
var threshold1 = document.getElementById("threshold1");
var threshold2 = document.getElementById("threshold2");

function setCheckboxStorageValue(el) {
  const options = {};
  options[el.id] = el.checked
  chrome.storage.sync.set(options);
}

function setTextStorageValue(el) {
  const options = {};
  options[el.id] = el.value
  chrome.storage.sync.set(options);
}

[checkbox1, checkbox2].forEach( it => {
  let el = it 
  let id = el.id
  chrome.storage.sync.get(id, function (data) {
    if (data[id] !== undefined) {
      el.checked = data[id];
    } else {
      setCheckboxStorageValue(el);
    }
  });
  el.addEventListener("change", function () {
    setCheckboxStorageValue(el);
  });
});

[threshold1, threshold2].forEach( it => {
  let el = it 
  let id = el.id
  chrome.storage.sync.get(id, function (data) {
    if (data[id] !== undefined) {
      el.value = data[id];
    } else {
      setTextStorageValue(el);
    }
  });
  el.addEventListener("change", function () {
    if (isNaN(el.value)) {
      el.value = 25
    }
    if (el.value < 0) {
      el.value = 0
    }
    if (el.value > 99) {
      el.value = 99
    }
    setTextStorageValue(el);
  });
});
