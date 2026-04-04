use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
use base64::{engine::general_purpose, Engine as _};
use clap::Parser;
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::io::{self, Read};

#[derive(Parser)]
#[command(name = "gremlin-secret", about = "One-time secret sharing CLI")]
struct Args {
    #[arg(long, default_value = "https://secure.gremlin.group")]
    base_url: String,

    #[arg(long, default_value = "604800", value_parser = clap::builder::PossibleValuesParser::new(["3600", "86400", "604800", "2592000"]))]
    ttl: String,

    #[arg(long, help = "Prompt for a password interactively")]
    password: bool,
}

#[derive(Serialize)]
struct CreateRequest {
    c: String,
    iv: String,
    pw: bool,
    ttl: u32,
}

#[derive(Deserialize)]
struct CreateResponse {
    id: String,
}

fn to_base64url(bytes: &[u8]) -> String {
    general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();
    let base_url = args.base_url.trim_end_matches('/');
    let ttl: u32 = args.ttl.parse()?;

    let mut secret = String::new();
    io::stdin().read_to_string(&mut secret)?;
    if secret.is_empty() {
        eprintln!("Error: no secret provided on stdin");
        std::process::exit(1);
    }

    let mut raw_key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut raw_key);

    let enc_key = if args.password {
        eprint!("Password: ");
        let pw = rpassword::read_password().expect("failed to read password");
        let mut derived = [0u8; 32];
        pbkdf2_hmac::<Sha256>(pw.as_bytes(), &raw_key, 600_000, &mut derived);
        derived
    } else {
        raw_key
    };

    let mut iv_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut iv_bytes);

    let cipher = Aes256Gcm::new_from_slice(&enc_key)?;
    let nonce = Nonce::from_slice(&iv_bytes);
    let ciphertext = cipher
        .encrypt(nonce, secret.as_bytes())
        .map_err(|e| format!("encryption failed: {}", e))?;

    let req = CreateRequest {
        c: general_purpose::STANDARD.encode(&ciphertext),
        iv: general_purpose::STANDARD.encode(&iv_bytes),
        pw: args.password,
        ttl,
    };

    let client = reqwest::blocking::Client::new();
    let res = client
        .post(format!("{}/api/notes", base_url))
        .json(&req)
        .send()?;

    if !res.status().is_success() {
        let body = res.text()?;
        eprintln!("Error: {}", body);
        std::process::exit(1);
    }

    let resp: CreateResponse = res.json()?;
    let raw_key_b64 = to_base64url(&raw_key);
    println!("{}/note/{}#{}", base_url, resp.id, raw_key_b64);

    Ok(())
}
