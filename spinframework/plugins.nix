{ lib, stdenv, fetchurl, fetchFromGitHub, autoPatchelfHook, gcc-unwrapped, zlib
, system }:

let
  manifestsDir = "${spinPluginsRepo}/manifests";
  allNames = builtins.attrNames (builtins.readDir manifestsDir);
  # All reliant on the EOL openssl1 disabled until they are updated
  pluginNames =
    let exclude = [ "trigger-kinesis" "trigger-command" "trigger-sqs" ];
    in lib.filter (name: !lib.elem name exclude) allNames;

  spinPluginsRepo = fetchFromGitHub {
    owner = "spinframework";
    repo = "spin-plugins";
    rev = "2a284fd93ba4fc9e745e5263874799dc7876482c";
    hash = "sha256-pdUcdgMKDwfgCpa1QU5UwtA8/8ulAyk79Q/olOhq4LM=";
  };

  systemToManifestFormat = {
    "x86_64-linux" = {
      os = "linux";
      arch = "amd64";
    };
    "aarch64-linux" = {
      os = "linux";
      arch = "aarch64";
    };
    "x86_64-darwin" = {
      os = "macos";
      arch = "amd64";
    };
    "aarch64-darwin" = {
      os = "macos";
      arch = "aarch64";
    };
  }.${system} or (throw "Unsupported system: ${system}");

  getPackageForSystem = manifest:
    let format = systemToManifestFormat;
    in builtins.head
    (builtins.filter (pkg: pkg.os == format.os && pkg.arch == format.arch)
      manifest.packages);

  # Build a plugin for a specific system
  buildPlugin = pluginName: system:
    let
      manifest = builtins.fromJSON (builtins.readFile
        "${spinPluginsRepo}/manifests/${pluginName}/${pluginName}.json");
      pkg = getPackageForSystem manifest;
    in stdenv.mkDerivation {
      pname = "fermyon-spin-plugin-${manifest.name}";
      version = manifest.version;

      src = fetchurl {
        url = pkg.url;
        hash = "sha256:${pkg.sha256}";
      };

      nativeBuildInputs = lib.optionals stdenv.isLinux [ autoPatchelfHook ];
      buildInputs = lib.optionals stdenv.isLinux [ gcc-unwrapped.lib zlib ];

      sourceRoot = ".";

      installPhase = ''
        runHook preInstall

        mkdir -p $out/bin

        install -m755 ${manifest.name} $out/bin/

        mkdir -p $out/share
        cp "${spinPluginsRepo}/manifests/${pluginName}/${pluginName}.json" $out/share/${pluginName}.json

        runHook postInstall
      '';

      meta = {
        description = manifest.description;
        homepage = manifest.homepage;
      };
    };

in lib.genAttrs pluginNames (plugin: buildPlugin plugin system)
