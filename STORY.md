# Project Story: Web Vulnerability Diagnosis Tool

This document outlines the architecture, workflow, and technical details of the Web Vulnerability Diagnosis Tool.

## 1. Project Overview

The project is a comprehensive web application vulnerability scanning tool based on the OWASP Security Testing Guideline and Japan's IPA "Web Application Health Check" specifications. It allows users to run security scans on their web applications and receive detailed reports.

The service provides:
- Quick vulnerability checks (within 10 minutes).
- Free basic scans with immediate, simplified reports.
- Detailed PDF reports available under paid plans.
- A command-line interface (CLI) for initiating scans.

## 2. Architecture

The system is composed of several microservices that work together to provide the vulnerability scanning functionality. The main components are the `web` application, the `scanner` service, the `browserless-rs` service, and the `zaproxy` service.

```mermaid
graph TD
    subgraph User Facing
        WebApp[apps/web<br>(Next.js)]
    end

    subgraph Backend Services
        Scanner[apps/scanner<br>(Rust)]
        Browserless[apps/browserless-rs<br>(Rust/Python)]
        ZAP[apps/zaproxy<br>(OWASP ZAP)]
    end

    subgraph Database
        DB[(Supabase<br>PostgreSQL)]
    end

    User -- Interacts with --> WebApp
    WebApp -- Initiates Scan --> Scanner
    WebApp -- Stores/Retrieves Data --> DB
    Scanner -- Uses --> Browserless
    Scanner -- Uses --> ZAP
    Scanner -- Stores/Retrieves Data --> DB
```

### Component Responsibilities:

-   **`apps/web`**: The main user-facing application built with Next.js. It handles user authentication, account management, subscription billing (via Stripe), domain management, and displays scan results.
-   **`apps/scanner`**: The core vulnerability scanning engine written in Rust. It takes scan jobs, orchestrates the scanning process using ZAP and Browserless, and stores the results in the database.
-   **`apps/browserless-rs`**: A headless browser service for interacting with web pages, taking screenshots, and executing JavaScript. This is crucial for scanning modern single-page applications (SPAs).
-   **`apps/zaproxy`**: A containerized instance of OWASP ZAP (Zed Attack Proxy), a widely-used open-source security tool. It performs the actual dynamic application security testing (DAST).

## 3. Application Details

### 3.1. Web Application (`apps/web`)

-   **Framework**: Next.js with App Router
-   **Backend**: Supabase (Auth, Database), Next.js Server Actions
-   **Database ORM**: Drizzle
-   **UI**: Tailwind CSS, shadcn/ui
-   **State Management**: XState, Zustand
-   **Payments**: Stripe

This application is the main entry point for users. They can sign up, manage their accounts and subscriptions, and submit their websites for scanning.

### 3.2. Scanner Service (`apps/scanner`)

-   **Language**: Rust
-   **Architecture**: A modular Cargo workspace with crates for API, core logic, types, and CLI.
-   **State Management**: `rust-state`
-   **Responsibilities**: Manages the entire lifecycle of a scan, from receiving the request to storing the final report. It communicates with ZAP to run the scans and with Browserless to interact with the target application.

### 3.3. Browserless Service (`apps/browserless-rs`)

-   **Language**: Rust (with a Python version also available)
-   **Functionality**: Provides a REST API for headless browser operations like scraping, taking screenshots, and evaluating JavaScript. It's a clone of the popular `browserless.io` service.

### 3.4. ZAP Proxy (`apps/zaproxy`)

-   **Tool**: OWASP ZAP
-   **Deployment**: Docker container
-   **Role**: Performs the heavy lifting of security scanning, including spidering the target application to discover URLs and then running active and passive scans to find vulnerabilities.

## 4. Workflow: Initiating a Scan

1.  A **User** logs into the **Web App** and submits a domain/URL for scanning.
2.  The **Web App** creates a new scan job in the **Supabase Database**.
3.  The **Scanner Service**, which may be polling for new jobs or receive a notification, picks up the new scan job.
4.  The **Scanner** initiates the scan by calling the **ZAP Proxy**.
5.  **ZAP** first spiders the target URL to discover all accessible pages. For dynamic/JS-heavy sites, the **Scanner** might use the **Browserless Service** to navigate the site and help ZAP discover more content.
6.  Once spidering is complete, **ZAP** runs an active scan on the discovered URLs, probing for vulnerabilities like XSS, SQL Injection, etc.
7.  Throughout the process, the **Scanner** updates the job status in the **Database**.
8.  When the scan is complete, the **Scanner** retrieves the results from **ZAP**, processes them, and stores the final report in the **Database**.
9.  The **User** can then view the scan results on the dashboard of the **Web App**.

## 5. Data Flow

-   **User Data & Subscriptions**: Stored in Supabase, managed by the `web` app.
-   **Scan Targets & Jobs**: Stored in Supabase, created by the `web` app and processed by the `scanner`.
-   **Scan Results & Reports**: Stored in Supabase, generated by the `scanner` and displayed by the `web` app.
-   **Temporary Scan Data**: Handled by ZAP and the scanner service during a scan.

## 6. Technology Stack Summary

-   **Frontend**: Next.js, React, TypeScript, Tailwind CSS, XState
-   **Backend**: Rust (Scanner), Supabase (Database, Auth), Next.js Server Actions
-   **Scanning Engine**: OWASP ZAP
-   **Infrastructure**: Docker, Vercel (for web app), Fly.io (for services)
-   **Database**: PostgreSQL
-   **Payments**: Stripe
