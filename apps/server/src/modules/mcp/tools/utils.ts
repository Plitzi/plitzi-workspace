export const toolResponseOk = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }]
});

export const toolResponseErr = (message: string) => ({
  content: [{ type: 'text' as const, text: message }],
  isError: true as const
});
