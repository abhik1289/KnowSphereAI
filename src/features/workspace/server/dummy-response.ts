export function generateDummyResponse(question: string) {
  const prompt = question.trim().replace(/\s+/g, " ");
  return [
    "This is a demo response and is **not generated from your uploaded documents**.",
    "",
    `You asked: “${prompt}”`,
    "",
    "Connect an AI provider to enable document-grounded answers. Your workspace, files, and conversation history are saved independently.",
  ].join("\n");
}
