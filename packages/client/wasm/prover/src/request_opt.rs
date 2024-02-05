use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyResult {
    pub server_name: String,
    pub time: u64,
    pub sent: String,
    pub recv: String,
}
