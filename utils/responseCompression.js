import compression from "compression";

export const responseCompression = () => compression({
  threshold: 1024,
  // Event streams must flush immediately instead of waiting for compression buffers.
  filter: (req, res) => !req.path.endsWith("/events") && compression.filter(req, res),
});
