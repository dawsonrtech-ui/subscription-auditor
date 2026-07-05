# Privacy Policy

**Last updated: [DATE — fill in when published]**

This Privacy Policy explains how Subscription Auditor ("we," "us," "our") collects, uses, stores, and protects your information when you use our website and application (the "Service").

> **Draft notice:** This document was prepared as a starting point and has not been reviewed by a lawyer. Before publishing it or onboarding paying customers, have it reviewed by a lawyer licensed in Nova Scotia (and any other jurisdiction where you have customers), particularly regarding PIPEDA compliance, cross-border data transfer, and any province-specific consumer protection rules.

---

## 1. Who we are

Subscription Auditor is operated by **Nick Dawson**, a sole proprietor based in Nova Scotia, Canada.

Contact: **[YOUR CONTACT EMAIL]**

---

## 2. Information we collect

### 2.1 Information you give us directly
- **Account information**: email address and password (stored as a one-way cryptographic hash — we never store your actual password).
- **Subscription data you enter manually**: names, categories, costs, billing cycles, renewal dates, and notes for subscriptions you track.
- **Budget preferences**: monthly budget targets you set per category.
- **Notification preferences**: how many days before renewal you want to be reminded.

### 2.2 Information from connected third-party services (only if you choose to connect them)

**Bank account data (via Plaid):**
If you choose to connect a bank account, we use Plaid Inc. ("Plaid") to securely retrieve:
- Transaction data (merchant names, amounts, dates, categories) from the accounts you authorize
- We use this data only to detect recurring charges and help you track subscriptions
- **We never receive or store your online banking username or password** — that exchange happens entirely between you and Plaid/your bank
- We do not have the ability to move money, initiate payments, or make changes to your bank account

**Gmail data (via Google's Gmail API):**
If you choose to connect Gmail, we request read-only access to scan your inbox for subscription-related receipts. Specifically:
- We read the subject line, sender, and date of emails to identify likely subscription receipts
- We do not read, store, or process the full body content of your emails beyond what's needed to detect a receipt
- We do not send email on your behalf, delete your email, or share your email content with anyone

**Google API Limited Use Disclosure:** Subscription Auditor's use and transfer of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. We do not use Gmail data for advertising purposes, we do not allow humans to read your Gmail data except (a) with your affirmative consent for specific messages, for security purposes, or to comply with applicable law, and we do not transfer Gmail data to third parties except as necessary to provide the Service, to comply with law, or as part of a merger/acquisition with your notice.

### 2.3 Information collected automatically
- Basic usage/technical data (IP address, browser type, timestamps of requests) as part of standard server logging, for security and troubleshooting purposes.

---

## 3. How we use your information

We use your information to:
- Provide the core Service (tracking subscriptions, calculating spending summaries, budget comparisons)
- Detect recurring charges from connected bank/email accounts
- Send you renewal reminder emails, if enabled
- Maintain the security and integrity of the Service
- Improve the Service based on aggregated, non-identifying usage patterns

We do **not**:
- Sell your personal information
- Use your bank or Gmail data for advertising or marketing to you or anyone else
- Share your data with third parties except the service providers listed below, who process it strictly on our behalf

---

## 4. Third-party service providers

We rely on the following providers to operate the Service. Each has its own privacy policy governing how they handle data:

| Provider | Purpose | Their Privacy Policy |
|---|---|---|
| Plaid Inc. | Bank account connection and transaction data | https://plaid.com/legal/#end-user-privacy-policy |
| Google LLC | Gmail API access for receipt scanning | https://policies.google.com/privacy |
| [Your hosting provider, e.g. Railway] | Application hosting and database storage | [link] |
| [Your email/SMTP provider] | Sending renewal reminder emails | [link] |

---

## 5. How we protect your information

- Passwords are hashed using bcrypt and are never stored or logged in plain text.
- All data in transit is encrypted via HTTPS/TLS.
- Bank access tokens and Gmail refresh tokens are stored server-side only and are never exposed to your browser or any client-side code.
- Access to production systems is limited to the operator of this Service.

No system is 100% secure, and we cannot guarantee absolute security, but we take reasonable, industry-standard measures to protect your information.

---

## 6. Data retention and deletion

- We retain your account data for as long as your account is active.
- You can disconnect your bank account or Gmail at any time from within the app, which removes our access going forward.
- You can request full deletion of your account and all associated data by contacting **[YOUR CONTACT EMAIL]**. We will delete your data within [30] days of a verified request, except where we're required to retain records by law.

---

## 7. Your rights

If you are a resident of Canada, you have rights under the *Personal Information Protection and Electronic Documents Act* (PIPEDA), including the right to:
- Know what personal information we hold about you
- Request access to and correction of your personal information
- Withdraw consent for our collection, use, or disclosure of your information (which may limit your ability to use parts of the Service)
- File a complaint with the Office of the Privacy Commissioner of Canada if you believe we have mishandled your information

If you are a resident of the United States or another jurisdiction with its own privacy laws (e.g., the EU/UK, California), you may have additional or different rights under those laws. Contact us and we will do our best to honor applicable requests.

---

## 8. International data transfer

Our hosting provider and some third-party services (such as Plaid and Google) may store or process data outside of Canada, including in the United States. By using the Service, you consent to this transfer, understanding that data protection laws in those countries may differ from those in Canada.

---

## 9. Children's privacy

The Service is not directed at children under 18, and we do not knowingly collect personal information from anyone under 18.

---

## 10. Changes to this policy

We may update this Privacy Policy from time to time. We will update the "Last updated" date above, and for material changes, we will make reasonable efforts to notify you (e.g., by email or an in-app notice).

---

## 11. Contact us

Questions about this Privacy Policy or your data? Contact:

**Nick Dawson**
**[YOUR CONTACT EMAIL]**
**[YOUR BUSINESS ADDRESS, if you have one — sole proprietors in Nova Scotia can often use a mailing address]**
