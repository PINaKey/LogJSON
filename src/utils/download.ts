/**
 * Downloads content as a file.
 */
export function downloadAsFile(
  content: string,
  fileName: string,
  contentType: string = 'text/plain'
): void {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
