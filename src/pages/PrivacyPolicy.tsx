import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import GlowBackdrop from "@/components/GlowBackdrop";
import Navbar from "@/components/Navbar";
import SeoHead from "@/components/SeoHead";

const PRIVACY_SEO_DESCRIPTION =
  "Read the AutoEditor Privacy Policy to understand what data we collect, how we use it, and your available privacy choices.";
const PRIVACY_SEO_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "AutoEditor Privacy Policy",
  "url": "https://www.autoeditor.app/privacy-policy",
  "description": PRIVACY_SEO_DESCRIPTION,
};

const PrivacyPolicy = () => {
  return (
    <GlowBackdrop>
      <SeoHead
        title="Privacy Policy | AutoEditor"
        description={PRIVACY_SEO_DESCRIPTION}
        path="/privacy-policy"
        jsonLd={PRIVACY_SEO_JSON_LD}
      />
      <Navbar />
      <main className="responsive-main min-h-screen px-4 pb-20 pt-24">
        <motion.div
          className="mx-auto mb-10 max-w-3xl text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold font-display text-foreground sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: March 2, 2026</p>
        </motion.div>

        <motion.div
          className="mx-auto max-w-3xl space-y-8 rounded-2xl border border-border/50 bg-card/50 p-6 sm:p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.45 }}
        >
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We collect account details you provide, such as name, email address, and payment-related billing data.
              We also collect usage data like page activity, device details, and feature interactions to operate and
              improve the product.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">2. How We Use Information</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">We use your information to:</p>
            <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
              <li>provide and maintain the service</li>
              <li>process billing and subscriptions</li>
              <li>improve performance, reliability, and product quality</li>
              <li>respond to support requests and service notices</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3. Sharing of Information</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We do not sell your personal data. We may share limited information with trusted providers (for example,
              hosting, analytics, and payment processors) only when needed to run the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">4. Cookies and Tracking</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We use cookies and similar technologies for authentication, security, and analytics. You can control
              cookie settings in your browser.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">5. Data Retention and Security</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We retain data only as long as needed for legal, operational, and service purposes. We use reasonable
              safeguards to protect data, but no method of storage or transmission is 100% secure.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">6. Your Choices</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You can update account information in your settings, request account deletion, or contact us to ask about
              your data.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">7. Contact</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              For privacy questions, contact us at <a className="text-primary underline-offset-4 hover:underline" href="mailto:privacy@autoeditor.pro">privacy@autoeditor.pro</a>.
            </p>
          </section>
        </motion.div>

        <div className="mx-auto mt-8 max-w-3xl text-center">
          <Link to="/" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Back to landing page
          </Link>
        </div>
      </main>
    </GlowBackdrop>
  );
};

export default PrivacyPolicy;
