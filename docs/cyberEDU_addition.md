This guide walks you through setting up **Truman Agents** and **TrumanWorld** inside a shared folder and running everything locally.

---

## 1. Folder Structure & Cloning Repos

1. Create an overarching folder:

```bash
mkdir CyberEDU
cd CyberEDU
```

2. Clone both repositories into `CyberEDU`:

```bash
git clone https://github.com/Cornell-Design-AI-Group/TrumanAgents.git
git clone https://github.com/Cornell-Design-AI-Group/TrumanWorld.git
```

---

## 2. Truman Agents Setup

### 2.1. MongoDB & Local Connection

In the `TrumanAgents` directory, follow the instructions in docs/setting-up-truman to:

1. Install dependencies
2. Set up MongoDB
3. Connect Truman Agents to your local MongoDB instance

> Do **all** the normal steps, but modify the **populate** step as below.

---

### 2.2. Populating the Database

From inside the `TrumanAgents` directory, run:

```bash
node populate.js scenarios/EXAMPLE
```

Modify accordingly based on the scenarios you are populating. To populate multiple scenarios as separate levels:

```bash
node populate.js scenarios/level1 scenarios/level2 scenarios/level3
```

See `scenarios/EXAMPLE/` for how to set up a scenario.

#### To delete all populated data and repopulate:

```bash
node populate.js --delete-all scenarios/EXAMPLE
```

---

### 2.3. Create a Session

From inside `TrumanAgents`:

```bash
node createSession.js sessionName

# Example:
node createSession.js level1
```

---

### 2.4. Create an Admin User

From inside `TrumanAgents`:

```bash
node addNewAdmin.js [email] [username] [password]

# Example:
node addNewAdmin.js researcher@university.edu myusername mypassword
```

After running this, an **API key** will be generated/logged.

👉 **Copy this API key** — you will need to paste it into the `local.config` file in `TrumanWorld`.

---

## 3. TrumanWorld Setup

From inside the `TrumanWorld` directory:

### 3.1. Install Dependencies

### 3.2. Backend Configuration

1. Open `/backend/README` and follow the instructions.
2. You will need to:
   - Configure the **Truman API key** (paste the one you copied earlier into `local.config` or the appropriate config file).
   - **Register for GEMINI** and set the required environment variables / config fields as described in the backend README.

---

## 4. Running Everything Locally

### 4.1. Run Truman Agents

From inside the `TrumanAgents` directory:

```bash
npm run dev
```

Keep this running.

---

### 4.2. Run TrumanWorld

In a **new terminal**, from inside `TrumanWorld/backend`:

```bash
python run_sim.py --config configs/local.json
```

Truman Agents and TrumanWorld should now both be running locally and connected via the configured API key and session.
