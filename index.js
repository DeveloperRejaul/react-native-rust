const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

// get file from argument
const sourceFile = process.argv[2];

if (!sourceFile) {
    console.log("Usage: node runCpp.js <file.cpp>");
    process.exit(1);
}

// create output binary name from file name
const outputFile = path.basename(sourceFile, ".cpp");

exec(`g++ -o ${outputFile} ${sourceFile} -L./target/release -lrust_to_cpp -Wl,-rpath,./target/release`, (compileErr, stdout, stderr) => {
    if (compileErr) {
        console.error("Compile Error:\n", stderr);
        return;
    }

    exec(`./${outputFile}`, (runErr, runStdout, runStderr) => {
        if (runErr) {
            console.error("Runtime Error:\n", runStderr);
        } else {
            console.log("Program Output:\n");
            console.log(runStdout);
        }

        // remove compiled binary
        fs.unlink(outputFile, (err) => {
            if (err) console.error("Error deleting file:", err);
        });
    });
});