function ready(fn) {
  if (document.readyState !== 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

function debounce(func, timeout = 0) {
    let timer;
    return (...args) => {
        const next = () => func(...args);
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(next, timeout > 0 ? timeout : 300);
    };
}

function uniqid() {
    var n = Math.floor(Math.random() * 11);
    var k = Math.floor(Math.random() * 1000000);
    return String.fromCharCode(n) + k;
}
