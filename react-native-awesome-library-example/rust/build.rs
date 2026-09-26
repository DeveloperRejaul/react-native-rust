use std::path::PathBuf;

fn main() {
    let crate_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let output = PathBuf::from(&crate_dir).join("include/rust_api.h");
    std::fs::create_dir_all(output.parent().unwrap()).unwrap();
    cbindgen::generate(&crate_dir)
        .expect("failed to generate the Rust C header")
        .write_to_file(output);
}
