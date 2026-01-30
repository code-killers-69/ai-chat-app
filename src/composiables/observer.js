const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) return;
      const container = entry.target;
      const imageElement = container.querySelector('img');
      const loadingElement = container.querySelector('div');
      loadingElement.classList.remove('hidden');
      const lazySrc = imageElement.getAttribute('lazySrc');
      imageElement.setAttribute('src', lazySrc);
      observer.unobserve(container);
    }
  },
  {
    root: null,
    rootMargin: '0px',
    threshold: [0],
  },
);
export default observer;
