import { createDropzone, createDownloadButton, downloadBlob, formatBytes } from '../../assets/ui.js';
import { parseImageMetadata, reencodeWithoutMetadata } from './logic.js';

const el = (tag, cls, value) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (value != null) node.textContent = value;
  return node;
};

export function mount(root) {
  let generation = 0;
  let source = null;
  const wrap = el('div', 'stack exif-tool');
  const drop = createDropzone({ title: 'Drop an image here', note: 'JPEG, PNG, WebP or TIFF',
    accept: '.jpg,.jpeg,.png,.webp,.tif,.tiff,image/jpeg,image/png,image/webp,image/tiff',
    ariaLabel: 'Choose an image to inspect or drop it here', onFiles: inspect });
  const details = el('section', 'panel stack-sm');
  details.hidden = true;
  details.append(el('h2', 'panel-title', 'Image metadata'));
  const fields = el('dl', 'stack-sm');
  details.append(fields);
  const warning = el('p', 'block block-error', 'GPS PRIVACY WARNING: This photo contains where it was taken.');
  warning.setAttribute('role', 'alert'); warning.hidden = true;
  const error = el('p', 'block block-error'); error.hidden = true; error.setAttribute('role', 'alert');
  const actions = el('div', 'status-row row');
  const download = createDownloadButton({ label: 'Download a copy without metadata' });
  const clear = el('button', 'btn btn-text', 'Clear'); clear.type = 'button';
  const status = el('p', 'status', 'Add an image to inspect its metadata.');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  actions.append(download.el, clear, status);
  wrap.append(drop.el, error, warning, details, actions); root.append(wrap);

  function reset() {
    generation++; source = null;
    fields.replaceChildren(); details.hidden = true; warning.hidden = true; error.hidden = true;
    download.setEnabled(false); drop.setCompact(false);
    status.textContent = 'Add an image to inspect its metadata.';
  }
  clear.addEventListener('click', reset);

  function fail(message) {
    error.textContent = message; error.hidden = false;
    status.textContent = 'Could not inspect this image.';
  }

  async function inspect(files) {
    const token = ++generation;
    source = null; fields.replaceChildren(); details.hidden = true; warning.hidden = true;
    error.hidden = true; download.setEnabled(false);
    status.textContent = 'Reading image metadata...';
    const file = files[0];
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (token !== generation) return;
      const signature = Array.from(bytes.subarray(0, 12));
      const type = bytes[0] === 255 && bytes[1] === 216 ? 'jpeg'
        : bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 ? 'png'
          : signature.slice(0, 4).join() === '82,73,70,70' && signature.slice(8, 12).join() === '87,69,66,80' ? 'webp'
            : bytes[0] === bytes[1] && (bytes[0] === 73 || bytes[0] === 77) ? 'tiff' : null;
      if (!type) { fail('Unsupported image format. Choose JPEG, PNG, WebP or TIFF.'); return; }
      const metadata = parseImageMetadata(bytes);
      source = { bytes, type, metadata, name: file.name };
      drop.setCompact(true, `1 file · ${formatBytes(file.size)}`);
      const replace = el('button', 'btn btn-text', 'Replace'); replace.type = 'button';
      replace.addEventListener('click', drop.open);
      drop.setCompactActions([replace]);
      if (!metadata.hasExif) {
        fields.append(el('p', 'field-hint', 'No EXIF metadata found.'));
      } else {
        const entries = [
          ['Make', metadata.make], ['Model', metadata.model], ['Software', metadata.software],
          ['Date/time', metadata.datetime], ['Exposure', metadata.exposure != null ? `${metadata.exposure} s` : null],
          ['ISO', metadata.iso], ['Focal length', metadata.focalLength != null ? `${metadata.focalLength} mm` : null],
          ['Orientation', metadata.orientation], ['Dimensions', metadata.width && metadata.height ? `${metadata.width} x ${metadata.height}` : null],
          ['GPS', metadata.gps ? `${metadata.gps.latitude.toFixed(6)}, ${metadata.gps.longitude.toFixed(6)}` : null],
        ];
        for (const [label, value] of entries) {
          if (value == null || value === '') continue;
          const row = el('div', 'row');
          row.append(el('dt', 'field-label', `${label}:`), el('dd', 'field-hint', String(value)));
          fields.append(row);
        }
        if (!fields.children.length) fields.append(el('p', 'field-hint', 'No recognized EXIF fields found.'));
      }
      warning.hidden = !metadata.hasGps;
      details.hidden = false; download.setEnabled(true);
      status.textContent = metadata.hasExif ? 'Metadata read locally.' : 'No EXIF found. You can still download a clean copy.';
    } catch (err) {
      if (token !== generation) return;
      fail(/malformed|truncated/i.test(err.message)
        ? 'Could not read this file. EXIF metadata is malformed or truncated. Try another image.'
        : 'Could not read this file. Try another image.');
    }
  }

  download.el.addEventListener('click', async () => {
    if (!source) return;
    const token = generation, current = source;
    download.setEnabled(false); status.textContent = 'Working... Re-encoding without metadata.';
    try {
      const blob = await reencodeWithoutMetadata(current.bytes, current.type, current.metadata.orientation);
      if (token !== generation) return;
      downloadBlob(blob, `${(current.name || 'image').replace(/\.[^.]+$/, '')}-clean.png`);
      status.textContent = 'Done. Downloaded a metadata-free PNG copy.';
    } catch {
      if (token !== generation) return;
      fail('Could not encode this image. This browser may not support decoding this format.');
    } finally {
      if (token === generation) download.setEnabled(true);
    }
  });
  return () => { generation++; source = null; };
}
