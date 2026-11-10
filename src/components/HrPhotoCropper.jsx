"use client";

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import styles from './HrPhotoCropper.module.css';

const OUTPUT_WIDTH = 600;
const OUTPUT_HEIGHT = 750;

export default function HrPhotoCropper({ file, onCancel, onConfirm }) {
  const { lang } = useLanguage();
  const viewportRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const [imageUrl, setImageUrl] = useState('');
  const [dimensions, setDimensions] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');
  const english = lang === 'en';

  useEffect(() => {
    if (typeof file === 'string') {
      setImageUrl(file);
      return;
    }
    // Use a data: URL instead of a blob: URL — the nginx CSP (img-src 'self' data:) blocks blob: images,
    // which made every locally chosen photo fail with "cannot read this photo".
    let cancelled = false;
    const reader = new FileReader();
    reader.onload = () => { if (!cancelled) setImageUrl(String(reader.result || '')); };
    reader.onerror = () => { if (!cancelled) setError(english ? 'Could not read this photo.' : '無法讀取此照片。'); };
    reader.readAsDataURL(file);
    return () => { cancelled = true; };
  }, [file]);

  function initializeImage() {
    const image = imageRef.current;
    const viewport = viewportRef.current;
    if (!image || !viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const scale = Math.max(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
    setDimensions({ width: image.naturalWidth, height: image.naturalHeight, baseScale: scale, viewportWidth: bounds.width, viewportHeight: bounds.height });
    setPosition({ x: (bounds.width - image.naturalWidth * scale) / 2, y: (bounds.height - image.naturalHeight * scale) / 2 });
  }

  function clampPosition(x, y, nextZoom = zoom) {
    if (!dimensions) return { x, y };
    const width = dimensions.width * dimensions.baseScale * nextZoom;
    const height = dimensions.height * dimensions.baseScale * nextZoom;
    return {
      x: Math.min(0, Math.max(dimensions.viewportWidth - width, x)),
      y: Math.min(0, Math.max(dimensions.viewportHeight - height, y)),
    };
  }

  function changeZoom(event) {
    const nextZoom = Number(event.target.value);
    const centerX = dimensions.viewportWidth / 2;
    const centerY = dimensions.viewportHeight / 2;
    const ratio = nextZoom / zoom;
    setPosition(clampPosition(centerX - (centerX - position.x) * ratio, centerY - (centerY - position.y) * ratio, nextZoom));
    setZoom(nextZoom);
  }

  function onPointerDown(event) {
    if (!dimensions) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, imageX: position.x, imageY: position.y };
  }

  function onPointerMove(event) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    const drag = dragRef.current;
    setPosition(clampPosition(drag.imageX + event.clientX - drag.startX, drag.imageY + event.clientY - drag.startY));
  }

  function onPointerUp(event) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function confirmCrop() {
    const image = imageRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const context = canvas.getContext('2d');
    if (!image || !dimensions || !context) {
      setError(english ? 'Could not prepare the cropped photo.' : '無法處理裁切照片。');
      return;
    }
    const scale = dimensions.baseScale * zoom;
    const sourceX = -position.x / scale;
    const sourceY = -position.y / scale;
    const sourceWidth = dimensions.viewportWidth / scale;
    const sourceHeight = dimensions.viewportHeight / scale;
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    onConfirm(canvas.toDataURL('image/jpeg', 0.9));
  }

  const imageStyle = dimensions ? {
    width: dimensions.width * dimensions.baseScale * zoom,
    height: dimensions.height * dimensions.baseScale * zoom,
    left: position.x,
    top: position.y,
  } : undefined;

  return <div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="photo-crop-title">
      <header className={styles.header}>
        <div><h2 id="photo-crop-title">{english ? 'Crop profile photo' : '裁切履歷照片'}</h2><p>{english ? 'Drag the photo to adjust the crop area.' : '拖曳照片調整擷取範圍。'}</p></div>
        <button type="button" className={styles.close} onClick={onCancel} aria-label={english ? 'Close crop tool' : '關閉裁切工具'}>×</button>
      </header>
      <div ref={viewportRef} className={styles.viewport} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {imageUrl&&<img ref={imageRef} src={imageUrl} alt="" draggable="false" onLoad={initializeImage} onError={() => setError(english ? 'Could not read this photo.' : '無法讀取此照片。')} style={imageStyle}/>}
        <div className={styles.cropFrame} aria-hidden="true"/>
      </div>
      <label className={styles.zoom}>{english ? 'Zoom' : '縮放'}<input type="range" min="1" max="3" step="0.01" value={zoom} disabled={!dimensions} onChange={changeZoom}/></label>
      {error&&<p className={styles.error} role="alert">{error}</p>}
      <footer className={styles.actions}><button type="button" className={styles.cancel} onClick={onCancel}>{english ? 'Cancel' : '取消'}</button><button type="button" className={styles.confirm} disabled={!dimensions} onClick={confirmCrop}>{english ? 'Use this crop' : '使用此範圍'}</button></footer>
    </section>
  </div>;
}
