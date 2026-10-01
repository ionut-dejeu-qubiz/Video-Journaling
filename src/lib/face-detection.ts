let loadPromise: Promise<any> | null = null;
let faceApiPromise: Promise<typeof import('@vladmandic/face-api')> | null = null;

function getFaceApi(): Promise<typeof import('@vladmandic/face-api')> {
  if (!faceApiPromise) faceApiPromise = import('@vladmandic/face-api');
  return faceApiPromise;
}

const MODEL_URL = '/models';

export async function loadFaceDetection(): Promise<any> {
  const faceapi = await getFaceApi();
  if (faceapi.nets.tinyFaceDetector.isLoaded) return faceapi;

  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]);
    return faceapi;
  })();

  try {
    return await loadPromise;
  } catch (err) {
    loadPromise = null;
    throw err;
  }
}

export async function loadFaceLandmarks(): Promise<any> {
  await loadFaceDetection();
  const faceapi = await getFaceApi();
  if (!faceapi.nets.faceLandmark68TinyNet.isLoaded) {
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
  }
  return faceapi;
}
