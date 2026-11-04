(() => {
  const capacitor = window.Capacitor;
  if (!capacitor?.isNativePlatform()) return;
  const Filesystem = capacitor.registerPlugin('Filesystem');
  const Share = capacitor.registerPlugin('Share');
  window.saveNativeDrawing = async canvas => {
    const path = 'coloring-day.png';
    await Filesystem.writeFile({ path, data: canvas.toDataURL('image/png').split(',')[1], directory: 'CACHE' });
    const { uri } = await Filesystem.getUri({ path, directory: 'CACHE' });
    await Share.share({ title: '나의 컬러링', files: [uri] });
  };
})();
