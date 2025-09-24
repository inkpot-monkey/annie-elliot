{
  description = "A Nix-flake-based pnpm typescript development environment";

  # Make sure packages are in the binary cache
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      inherit (builtins) attrValues;

      supportedSystems = [ "x86_64-linux" ];

      forEachSupportedSystem =
        f:
        nixpkgs.lib.genAttrs supportedSystems (
          system:
          f {
            pkgs = import nixpkgs { inherit system; };
            inherit system;
          }
        );

    in
    {
      packages = forEachSupportedSystem (
        { pkgs, ... }:
        {
          default = pkgs.callPackage ./spinframework/package.nix { };
        }
      );

      devShells = forEachSupportedSystem (
        { pkgs, system }:
        {
          default = pkgs.mkShell {
            packages = attrValues {
              # Nix
              inherit (pkgs) nil nixfmt;

              # Language Servers
              inherit (pkgs) yaml-language-server vscode-langservers-extracted;
              inherit (pkgs.nodePackages)
                typescript-language-server
                bash-language-server
                ;

              # Node
              inherit (pkgs) nodejs_24;
              inherit (pkgs.nodePackages) pnpm;

              # Python (for stylelint)
              inherit (pkgs) python3;

              # Cloudflare
              inherit (pkgs.nodePackages) wrangler;

              inherit (self.packages.${system}) default;
            };
          };
        }
      );
    };
}
