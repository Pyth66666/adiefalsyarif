"use client";
import Image from "next/image";

/** Authentic rover photography, held still. No synthetic rover or pointer animation. */
export function MarsScene({ subtle=false }: { subtle?:boolean }) {
  return <div className={`mars-scene ${subtle?"mars-scene-subtle":""}`}>
    <div className="mars-terrain" aria-hidden="true">
      <Image src="/space/mars-curiosity.jpg" alt="" fill sizes="100vw" quality={85}/>
    </div>
    <div className="mars-shade" aria-hidden="true"/>
    {!subtle && <a className="mars-photo-credit" href="https://www.jpl.nasa.gov/images/pia19839-strata-at-base-of-mount-sharp/" target="_blank" rel="noopener noreferrer">
      MARS / CURIOSITY · NASA/JPL-Caltech/MSSS
    </a>}
  </div>;
}
