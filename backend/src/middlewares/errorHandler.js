export function notFound(_req, res) {
  res.status(404).json({ message: 'Nie znaleziono trasy' });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Nieprawidłowy format JSON' });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    return res.status(409).json({
      message: field ? `Wartość pola "${field}" już istnieje` : 'Wartość pola unikalnego już istnieje'
    });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: Object.values(err.errors).map(item => item.message).join(', ')
    });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Nieprawidłowy identyfikator' });
  }
  const status = err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Wewnętrzny błąd serwera'
  });
}
