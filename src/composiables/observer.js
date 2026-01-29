const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      console.error(entry);
      // v-show导致的
      const imageElement = entry.target;
      const lazySrc = imageElement.getAttribute('lazySrc');
      imageElement.setAttribute('src', lazySrc);
    }
  },
  {
    root: null,
    rootMargin: '0px',
    threshold: [0],
  },
);
export default observer;
