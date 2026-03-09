const index = {
  http: `export default function (req, res) {
\treturn res.status(201).send("Spica is awesome!");
}`,
  scheduler: `export default function () {
\treturn console.log("This function is executed every minute.");
}`,
  database: `export default function (change) {
\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of collection " + change.collection);
\tconsole.log("Document: ",change.document);
}`,

  firehose: `export default function ({ socket, pool }, message) {
\tconsole.log(message.name); // name is the event name that has been triggered
\tconsole.log(message.data); // use this field to pass data from client to server
\tconst isAuthorized = false;
\tif (isAuthorized) {
\t\tsocket.send("authorization", { state: true });
\t\tpool.send("connection", { id: socket.id, ip_address: socket.remoteAddress });
\t} else {
\t\tsocket.send("authorization", { state: false, error: "Authorization has failed." });
\t\tsocket.close();
\t}
}`,
  system: `export default function () {
\tconsole.log("Spica is ready.");
}`,
  bucket: `export default function (change) {
\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of bucket with id " + change.bucket);
\tconsole.log("Previous document: ",change.previous);
\tif (change.current) {
\t\tconsole.log("Current document: ",change.current)
\t}
}`,
};

export { index };
