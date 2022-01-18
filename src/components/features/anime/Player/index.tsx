import { VideoContextProvider } from "@/contexts/VideoContext";
import { VideoStateProvider } from "@/contexts/VideoStateContext";
import useDevice from "@/hooks/useDevice";
import useVideoShortcut from "@/hooks/useVideoShortcut";
import useHandleTap from "@/hooks/useHandleTap";
import { Source } from "@/types";
import classNames from "classnames";
import { motion, TapHandlers } from "framer-motion";
import React, {
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BrowserView, MobileView } from "react-device-detect";
import { useHotkeys } from "react-hotkeys-hook";
import ClientOnly from "@/components/shared/ClientOnly";
import DesktopControls from "@/components/features/anime/Player/DesktopControls";
import HlsPlayer from "@/components/features/anime/Player/HlsPlayer";
import MobileControls from "@/components/features/anime/Player/MobileControls";
import Overlay from "@/components/features/anime/Player/Overlay";
import { AiFillFastBackward, AiFillFastForward } from "react-icons/ai";

const noop = () => {};
interface VideoProps
  extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, "src"> {
  src: Source[];
  overlaySlot?: React.ReactNode;
  onKeyNextEpisode: () => void;
  onKeyPreviousEpisode: () => void;
}

const Video = React.forwardRef<HTMLVideoElement, VideoProps>(
  ({ overlaySlot, onKeyNextEpisode, onKeyPreviousEpisode, ...props }, ref) => {
    const myRef = useRef<HTMLVideoElement>();
    const [refHolder, setRefHolder] = useState<HTMLVideoElement>(null);
    const [showControls, setShowControls] = useState(true);
    const [isBuffering, setIsBuffering] = useState(false);
    const timeout = useRef<NodeJS.Timeout>(null);
    const { isMobile } = useDevice();

    const handleTouchMove: React.TouchEventHandler<HTMLDivElement> = (e) => {
      const target = e.target as HTMLDivElement;

      if (!target.closest(".progress-control")) return;

      handleKeepControls(null);
    };

    const handleKeepControls = (e: any) => {
      if (!e) {
        startControlsCycle();

        return;
      }

      const target = e.target as HTMLDivElement;

      if (target.classList.contains("video-overlay") && isMobile) {
        setShowControls(false);
      } else {
        startControlsCycle();
      }
    };

    const startControlsCycle = useCallback(() => {
      setShowControls(true);

      if (timeout.current) {
        clearTimeout(timeout.current);
      }

      timeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }, []);

    const handleDoubleTap: TapHandlers["onTap"] = (e, info) => {
      const backwardIndicator = document.querySelector(".backward-indicator");
      const forwardIndicator = document.querySelector(".forward-indicator");

      const widthPercent = 45;
      const width = (window.innerWidth * widthPercent) / 100;

      if (info.point.x < width) {
        myRef.current.currentTime = myRef.current.currentTime - 10;
        backwardIndicator.classList.toggle("opacity-0");

        setTimeout(() => {
          backwardIndicator.classList.toggle("opacity-0");
        }, 350);
      } else {
        myRef.current.currentTime = myRef.current.currentTime + 10;
        forwardIndicator.classList.toggle("opacity-0");

        setTimeout(() => {
          forwardIndicator.classList.toggle("opacity-0");
        }, 350);
      }
    };

    const handleTap = useHandleTap({
      onTap: handleKeepControls,
      onDoubleTap: handleDoubleTap,
      tapThreshold: isMobile ? 250 : 0,
    });

    useEffect(() => {
      if (!myRef.current) return;

      setRefHolder(myRef.current);
    }, [ref, props.src]);

    useEffect(() => {
      const element = myRef.current;

      const handleWaiting = () => {
        setIsBuffering(true);
      };

      const handlePlaying = () => {
        setIsBuffering(false);
      };

      element.addEventListener("waiting", handleWaiting);
      element.addEventListener("playing", handlePlaying);
      element.addEventListener("play", handlePlaying);

      return () => {
        element.removeEventListener("waiting", handleWaiting);
        element.removeEventListener("playing", handlePlaying);
        element.removeEventListener("play", handlePlaying);
      };
    }, []);

    useVideoShortcut(refHolder, {
      onNextEpisode: onKeyNextEpisode,
      onPreviousEpisode: onKeyPreviousEpisode,
    });

    useHotkeys("*", () => {
      handleKeepControls(null);
    });

    const defaultQualities = useMemo(
      () => props.src.map((source) => source.label),
      [props.src]
    );

    return (
      <VideoContextProvider el={refHolder}>
        <VideoStateProvider defaultQualities={defaultQualities}>
          <motion.div
            className={classNames("video-wrapper relative overflow-hidden")}
            onMouseMove={isMobile ? noop : handleKeepControls}
            onTouchMove={handleTouchMove}
            onTap={handleTap}
          >
            {/* Controls */}
            <motion.div
              variants={{
                show: { y: 0, opacity: 1 },
                hidden: { y: "100%", opacity: 0 },
              }}
              animate={showControls || isBuffering ? "show" : "hidden"}
              initial="hidden"
              exit="hidden"
              className="absolute bottom-0 z-50 w-full"
              transition={{ ease: "linear", duration: 0.2 }}
            >
              <ClientOnly>
                <BrowserView>
                  <DesktopControls />
                </BrowserView>

                <MobileView>
                  <MobileControls />
                </MobileView>
              </ClientOnly>
            </motion.div>

            <Overlay showControls={showControls || isBuffering}>
              {overlaySlot}
            </Overlay>

            <div
              className="backward-indicator bg-white/20 absolute left-0 w-[45vw] h-full flex flex-col items-center justify-center transition duration-300 opacity-0"
              style={{ borderRadius: "0% 20% 20% 0% / 50% 50% 50% 50%" }}
            >
              <AiFillFastBackward className="w-12 h-12" />
              <p className="rounded-full text-xl">-10 giây</p>
            </div>

            <div
              className="forward-indicator bg-white/20 absolute right-0 w-[45vw] h-full flex flex-col items-center justify-center transition duration-300 opacity-0"
              style={{ borderRadius: "20% 0% 0% 20% / 50% 50% 50% 50%" }}
            >
              <AiFillFastForward className="w-12 h-12" />
              <p className="rounded-full text-xl">+10 giây</p>
            </div>

            <div className="w-full h-screen">
              <HlsPlayer
                ref={(node) => {
                  myRef.current = node;
                  if (typeof ref === "function") {
                    ref(node);
                  } else if (ref) {
                    (ref as MutableRefObject<HTMLVideoElement>).current = node;
                  }
                }}
                {...props}
              />
            </div>
          </motion.div>
        </VideoStateProvider>
      </VideoContextProvider>
    );
  }
);

Video.displayName = "Video";

export default React.memo(Video);