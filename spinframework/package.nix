{ lib, stdenv, fetchurl, fetchFromGitHub, autoPatchelfHook, gcc-unwrapped, zlib
, makeWrapper, callPackage, plugins ? [ "cloud" "js2wasm" ] }:

let
  system = stdenv.hostPlatform.system;

  platform = {
    x86_64-linux = "linux-amd64";
    aarch64-linux = "linux-aarch64";
    x86_64-darwin = "macos-amd64";
    aarch64-darwin = "macos-aarch64";
  }.${system} or (throw "Unsupported system: ${system}");

  packageHash = {
    x86_64-linux = "sha256-iCPptTP682eieeLZWMRH6cbw3dQ/+ujC4bsJQBzHbpg=";
    aarch64-linux = "sha256-qEuWzAlxMzE12MU6xVwrYh6/qPi3XVYZPws8c67xdVk=";
    x86_64-darwin = "sha256-7B1dB5DjUMpg2m0xFitanYDTuw/3c8s3lzTrSe5fKN4=";
    aarch64-darwin = "sha256-FR4FEv2Z6Dc/zX6jufTyWVCnLFDxu9YK4v8Q5jhOCiw=";
  }.${system} or (throw "Unsupported system: ${system}");

  # Build all the requested plugins
  pluginsSet = import ./plugins.nix {
    inherit system lib stdenv fetchurl fetchFromGitHub autoPatchelfHook
      gcc-unwrapped zlib;
  };

  templates = fetchFromGitHub {
    owner = "spinframework";
    repo = "spin";
    rev = "v3.2.0";
    hash = "sha256-g6Qj0CYsd/+c4qR4aRHKkvb4+BT1dC+0vN5GmdMaeic=";
  };

in stdenv.mkDerivation (finalAttrs: {
  pname = "spinframework";
  version = "3.2.0";

  # Use fetchurl rather than fetchzip as these tarballs are built by the project
  # and not by GitHub (and thus are stable) - this simplifies the update script
  # by allowing it to use the output of `nix store prefetch-file`.
  src = fetchurl {
    url =
      "https://github.com/${finalAttrs.pname}/spin/releases/download/v${finalAttrs.version}/spin-v${finalAttrs.version}-${platform}.tar.gz";
    hash = packageHash;
  };

  sourceRoot = ".";

  nativeBuildInputs = [ makeWrapper ]
    ++ lib.optionals stdenv.hostPlatform.isLinux [ autoPatchelfHook ];

  buildInputs = [ gcc-unwrapped.lib zlib ];

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin
    install -m755 ./spin $out/bin/

    DATA_PATH=$out/data/spin
    PLUGINS_PATH=$DATA_PATH/plugins
    mkdir -p $PLUGINS_PATH/manifests

      ${
        lib.concatStringsSep "\n" (lib.mapAttrsToList (name: plugin: ''
          mkdir -p $PLUGINS_PATH/${name}
          cp ${plugin.outPath}/bin/* $PLUGINS_PATH/${name}/
          cp ${plugin.outPath}/share/* $PLUGINS_PATH/manifests/
        '') pluginsSet)
      }

    TEMPLATES_PATH=$out/data/spin/templates
    mkdir -p $TEMPLATES_PATH
      for d in ${templates}/templates/*/; do
        # just use a fake hash as this is already source controlled with Nix     
        tpl="$(basename $d)"
        mkdir -p "$TEMPLATES_PATH/$tpl"
        cp -r "$d/." "$TEMPLATES_PATH/$tpl/"
      done

    wrapProgram $out/bin/spin \
      --set XDG_DATA_HOME $out/data

    runHook postInstall
  '';

  meta = with lib; {
    description =
      "Framework for building, deploying, and running fast, secure, and composable cloud microservices with WebAssembly";
    homepage = "https://github.com/spinframework/spin";
    sourceProvenance = with sourceTypes; [ binaryNativeCode ];
    license = with licenses; [ asl20 ];
    mainProgram = "spin";
    maintainers = with maintainers; [ mglolenstine ];
    platforms = platforms.linux ++ platforms.darwin;
  };
})
