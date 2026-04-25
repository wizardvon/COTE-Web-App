import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const teacherResourcePanel = document.getElementById('teacherResourcePanel');
const resourceForm = document.getElementById('resourceForm');
const resourceTitleInput = document.getElementById('resourceTitle');
const resourceUrlInput = document.getElementById('resourceUrl');
const youtubeDetectHint = document.getElementById('youtubeDetectHint');
const resourceSaveStatus = document.getElementById('resourceSaveStatus');
const resourcesList = document.getElementById('resourcesList');

function extractYouTubeVideoId(rawUrl = '') {
  if (!rawUrl) return null;

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

  if (host === 'youtu.be') {
    const id = parsed.pathname.split('/').filter(Boolean)[0];
    return sanitizeVideoId(id);
  }

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (parsed.pathname === '/watch') {
      return sanitizeVideoId(parsed.searchParams.get('v'));
    }

    if (parsed.pathname.startsWith('/shorts/')) {
      const id = parsed.pathname.split('/').filter(Boolean)[1];
      return sanitizeVideoId(id);
    }

    if (parsed.pathname.startsWith('/embed/')) {
      const id = parsed.pathname.split('/').filter(Boolean)[1];
      return sanitizeVideoId(id);
    }
  }

  return null;
}

function sanitizeVideoId(id) {
  if (!id) return null;
  const cleaned = String(id).trim();
  return /^[a-zA-Z0-9_-]{6,}$/.test(cleaned) ? cleaned : null;
}

export function getYouTubeEmbedUrl(url) {
  const videoId = extractYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

function renderResourceCard(resource) {
  const card = document.createElement('article');
  card.className = 'resource-card';

  const title = document.createElement('h3');
  title.textContent = resource.title || 'Untitled Resource';
  card.appendChild(title);

  const embedUrl = getYouTubeEmbedUrl(resource.url);
  if (embedUrl) {
    const wrapper = document.createElement('div');
    wrapper.className = 'video-wrapper';

    const iframe = document.createElement('iframe');
    iframe.src = embedUrl;
    iframe.title = 'YouTube video player';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;

    wrapper.appendChild(iframe);
    card.appendChild(wrapper);
  }

  const openBtn = document.createElement('a');
  openBtn.className = 'link-btn resource-open-btn';
  openBtn.href = resource.url;
  openBtn.target = '_blank';
  openBtn.rel = 'noopener noreferrer';
  openBtn.textContent = 'Open Resource';

  card.appendChild(openBtn);

  return card;
}

async function loadResources() {
  resourcesList.innerHTML = '<p class="small-note">Loading resources...</p>';

  try {
    const resourcesQuery = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(resourcesQuery);

    if (snap.empty) {
      resourcesList.innerHTML = '<p class="small-note">No resources yet.</p>';
      return;
    }

    resourcesList.innerHTML = '';
    snap.forEach((entry) => {
      const data = entry.data();
      resourcesList.appendChild(renderResourceCard({ id: entry.id, ...data }));
    });
  } catch (err) {
    console.error(err);
    resourcesList.innerHTML = '<p class="small-note">Unable to load resources right now.</p>';
  }
}

resourceUrlInput?.addEventListener('input', () => {
  const embedUrl = getYouTubeEmbedUrl(resourceUrlInput.value);
  youtubeDetectHint.classList.toggle('hidden', !embedUrl);
});

resourceForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const title = resourceTitleInput.value.trim();
  const url = resourceUrlInput.value.trim();

  if (!title || !url) {
    resourceSaveStatus.textContent = 'Please enter both title and URL.';
    return;
  }

  resourceSaveStatus.textContent = 'Saving resource...';

  try {
    await addDoc(collection(db, 'resources'), {
      title,
      url,
      ownerUid: auth.currentUser.uid,
      createdAt: serverTimestamp()
    });

    resourceForm.reset();
    youtubeDetectHint.classList.add('hidden');
    resourceSaveStatus.textContent = 'Resource saved.';

    await loadResources();
  } catch (err) {
    console.error(err);
    resourceSaveStatus.textContent = 'Failed to save resource.';
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const role = userDoc.exists() ? userDoc.data().role : null;
    teacherResourcePanel.classList.toggle('hidden', role !== 'teacher');
  } catch (err) {
    console.error(err);
    teacherResourcePanel.classList.add('hidden');
  }

  await loadResources();
});
