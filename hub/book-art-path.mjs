// Bounded art routes, including composed portrait/landscape paintings.
// No decoded separators, traversal, arbitrary subdirectories or non-image extensions.
export const bookArtMatch=pathname=>String(pathname).match(/^\/book-art\/((?:bg\/(?:real-foreground\/)?|actors\/|props\/)[A-Za-z0-9-]{1,60}\.(webp|png|svg|jpg))$/);
