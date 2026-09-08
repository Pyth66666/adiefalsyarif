"use client";

import { motion } from "framer-motion";
import { TextReveal } from "@/components/shared/TextReveal";
import { useCms } from "@/components/cms/CmsGate";

/**
 * Final pit stop: a large CTA, an email, and only real social links.
 */
export function ContactFooter() {
  const { site, socials } = useCms();
  const email = site.contactEmail;
  const tech = socials.filter((s) => s.group === "tech");
  const creative = socials.filter((s) => s.group === "creative");
  const hasTech = tech.length > 0;
  const hasCreative = creative.length > 0;

  return (
    <footer
      id="contact"
      className="relative w-full bg-ink pt-28"
      aria-label="Contact and footer"
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <TextReveal as="p" className="text-xs tracking-[0.4em] text-paper/50">
          CONTACT
        </TextReveal>
        <TextReveal as="h2" delay={0.05} className="mt-8 font-display text-[11vw] leading-[0.95] tracking-[0.05em] md:text-[8vw]">
          LET&apos;S BUILD
          <br />
          <span className="text-paper/50">SOMETHING.</span>
        </TextReveal>

        <motion.div
          className="mt-14 flex flex-col gap-10 border-t border-white/10 py-14 md:flex-row md:justify-between"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <h3 className="text-[0.6rem] tracking-[0.35em] text-paper/50">BUSINESS ENQUIRIES</h3>
            {email ? (
              <a href={`mailto:${email}`} data-cursor="enter" className="mt-3 block font-display text-xl text-paper underline-offset-4 hover:underline md:text-2xl">
                {email}
              </a>
            ) : (
              <p className="mt-3 text-sm italic text-paper/40">
                [SET CONTACT EMAIL IN ADMIN]
              </p>
            )}
          </div>

          {hasTech && (
            <div>
              <h3 className="text-[0.6rem] tracking-[0.35em] text-paper/50">TECH</h3>
              <ul className="mt-3 space-y-1">
                {tech.map((s) => (
                  <li key={s.id}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      data-cursor="view"
                      className="text-sm text-paper/80 transition-colors hover:text-paper"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasCreative && (
            <div>
              <h3 className="text-[0.6rem] tracking-[0.35em] text-paper/50">CREATIVE</h3>
              <ul className="mt-3 space-y-1">
                {creative.map((s) => (
                  <li key={s.id}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      data-cursor="view"
                      className="text-sm text-paper/80 transition-colors hover:text-paper"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      </div>

      <div className="border-t border-white/5 py-6">
        <p className="text-center text-[0.55rem] tracking-[0.3em] text-paper/30">
          ADIEF AL SYARIF — ADIEFALSYARIF.COM
        </p>
      </div>
    </footer>
  );
}