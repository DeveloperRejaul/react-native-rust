use cbindgen::Config;

fn main() {
    let crate_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    
    let config = Config::from_file("cbindgen.toml")
        .unwrap_or_default();
    
    cbindgen::generate_with_config(&crate_dir, config)
        .unwrap()
        .write_to_file("add_rust.h");
}
