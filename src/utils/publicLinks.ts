const PUBLISHED_APP_URL = 'https://solucoesdpmv.lovable.app';

export const getExternalAppOrigin = () => {
  if (typeof window === 'undefined') return PUBLISHED_APP_URL;

  const { origin, hostname } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  const isLovablePreview = hostname.includes('lovableproject.com') || hostname.includes('id-preview--');

  return isLocal || isLovablePreview ? PUBLISHED_APP_URL : origin;
};

export const buildExternalAppLink = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getExternalAppOrigin()}${normalizedPath}`;
};