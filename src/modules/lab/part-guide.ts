import type { PartId } from "@/components/equipment-3d/parts";
import type { TubeStyle } from "@/components/equipment-3d/dimensions";

export interface PartGuide {
  name: string;
  /** What it is and what it does. */
  what: string;
  /** A practical tip for using it. */
  tip: string;
}

/** Plain-language explanations of each part, for the workbench. */
export function partGuide(id: PartId, style: TubeStyle): PartGuide {
  switch (id) {
    case "tube":
      return {
        name: "Optical tube",
        what: "Holds the optics in precise alignment and keeps stray light out.",
        tip: "Set it outside 30–60 minutes before observing so it cools to the night air; warm air inside the tube blurs planets.",
      };
    case "objective":
      return style === "refractor"
        ? {
            name: "Objective lens",
            what: "The big lens at the front collects light and brings it to a focus. Its diameter (aperture) sets how faint you can see and how fine the detail can be.",
            tip: "Keep the dust cap on when not observing. A little dust hardly matters; clean it only when really needed.",
          }
        : style === "newtonian"
          ? {
              name: "Primary and secondary mirrors",
              what: "The curved primary mirror at the back collects light; a small flat secondary near the front sends it out of the side to the focuser.",
              tip: "Newtonians need collimating (aligning the mirrors) from time to time. A defocused star with an off-centre dark spot means it is due.",
            }
          : {
              name: "Corrector plate and mirrors",
              what: "Light passes the thin front corrector, bounces off the primary mirror at the back and the small secondary on the corrector, then out through the rear port.",
              tip: "The folded light path makes a long focal length in a short tube: great for planets, the Moon and small objects.",
            };
    case "focuser":
      return style === "sct" || style === "maksutov"
        ? {
            name: "Focus knob",
            what: "On this design the knob moves the primary mirror inside the tube, so nothing racks in or out.",
            tip: "Finish focusing with a turn in the same direction each time to stop the image shifting.",
          }
        : {
            name: "Focuser",
            what: "The drawtube racks in and out to put the eyepiece or camera exactly at the focal plane.",
            tip: "Focus on a bright star until it is the smallest, sharpest point. Out of focus, a reflector shows a ring with a dark centre: the secondary mirror's shadow.",
          };
    case "finder":
      return {
        name: "Finder",
        what: "A small wide-field scope (or red-dot sight) for aiming; the main telescope shows only a tiny patch of sky.",
        tip: "Line it up with the main telescope in daylight on a distant treetop or mast. Never point any telescope near the Sun.",
      };
    case "dovetail":
      return {
        name: "Tube rings and dovetail",
        what: "The rings clamp the tube; the dovetail bar slides into the mount's saddle.",
        tip: "Slide the tube in its rings to balance it front-to-back (the declination axis) before balancing with the counterweight.",
      };
    case "diagonal":
      return {
        name: "Star diagonal",
        what: "A mirror or prism that turns the light 90° so you can look down into the eyepiece comfortably.",
        tip: "It shows the sky mirror-reversed, which is why charts sometimes do not match the view.",
      };
    case "eyepiece":
      return {
        name: "Eyepiece",
        what: "Magnifies the image the telescope forms. Magnification = telescope focal length ÷ eyepiece focal length; the apparent field sets how wide the view feels.",
        tip: "Start with your longest eyepiece (lowest power) to find a target, then switch to a shorter one to zoom in.",
      };
    case "camera":
      return {
        name: "Camera",
        what: "Its sensor sits at the focal plane in place of an eyepiece (prime focus). Image scale = 206 × pixel size (µm) ÷ focal length (mm) arcseconds per pixel.",
        tip: "A camera usually needs the drawtube further in than an eyepiece. Some Newtonians need an extension tube or a low-profile focuser to reach focus.",
      };
    case "barlow":
      return {
        name: "Barlow lens",
        what: "A negative lens that multiplies the focal length: a 2× Barlow doubles the magnification of every eyepiece.",
        tip: "Put it in first, then the eyepiece, and refocus. Two eyepieces plus a Barlow give you four magnifications.",
      };
    case "filter":
      return {
        name: "Filter",
        what: "Threads into the eyepiece barrel or camera nosepiece and passes only some colours. Nebula filters (UHC, OIII) darken the sky around emission nebulae.",
        tip: "Nebula filters do not help galaxies or star clusters; they dim the stars too.",
      };
    case "tripod":
      return {
        name: "Tripod",
        what: "A steady base. Every shake shows up magnified in the eyepiece.",
        tip: "Extend the legs only as far as you need and level the head (use the bubble level) before polar aligning.",
      };
    case "ra-axis":
      return {
        name: "Right-ascension (polar) axis",
        what: "Once it points at the celestial pole it is parallel to Earth's axis, so following a star needs this one axis to turn once every 23 h 56 min.",
        tip: "Loosen the RA clutch to swing the telescope by hand; tighten it before using the slow-motion control or motor.",
      };
    case "dec-axis":
      return {
        name: "Declination axis",
        what: "Moves the tube north and south across the sky. Once you are on a target it stays fixed while the RA axis tracks.",
        tip: "In the home position the tube points at the pole (declination 90°) with the counterweight hanging down.",
      };
    case "counterweight":
      return {
        name: "Counterweight",
        what: "Balances the tube's weight around the RA axis so the motor or your hand moves it smoothly and the mount does not strain.",
        tip: "Fit counterweights before the tube and remove the tube first, or the mount can swing round.",
      };
    case "latitude-adjuster":
      return {
        name: "Latitude bolts",
        what: "Tilt the polar axis so its angle above the horizon equals your latitude, which is also the height of the celestial pole in your sky.",
        tip: "Loosen one bolt before tightening the other; they push against each other.",
      };
    case "azimuth-adjuster":
      return {
        name: "Azimuth bolts",
        what: "Turn the mount head left and right to point the polar axis at true north (true south in the southern hemisphere).",
        tip: "True north is not magnetic north; in many places a compass is several degrees off. Polaris sits within 1° of the north celestial pole.",
      };
    case "altaz-head":
      return {
        name: "Alt-azimuth head",
        what: "Moves up/down (altitude) and left/right (azimuth). Simple and quick to set up; no polar alignment needed.",
        tip: "The field slowly rotates as an alt-az mount tracks, which limits long exposures; for visual use it does not matter.",
      };
    case "dob-base":
      return {
        name: "Dobsonian rocker box",
        what: "A simple wooden alt-azimuth base: the tube rocks on side bearings and the box turns on a ground board.",
        tip: "Nudge the tube along as the target drifts; it moves faster across the field at high magnification.",
      };
  }
}
