import argparse
import jedi
import json
import sys
import os
try: # python 2
    import urlparse
    from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
except: # python 3
    import urllib.parse as urlparse
    from http.server import BaseHTTPRequestHandler, HTTPServer

def main(args):
    if args.mode != "daemon":
        print(run(sys.stdin.read(), args.__dict__))
        return

    jedi.preload_module("os", "sys", "math")
    try:
        server = HTTPServer(("localhost", int(args.port)), Daemon)
    except:
        sys.stderr.write("Daemon unable to listen at :%s\n" % args.port)
        sys.exit(98)
    sys.stderr.write("Daemon " + "listening at :%s\n" % args.port) # concat strings to avoid matching this string in the client
    server.serve_forever()

def run(source, args):
    script = jedi.Script(source, int(args.get("row")), int(args.get("column")), args.get("path"))
    try:
        result = getattr(script, args.get("mode"))()
    except:
        result = []
    return json.dumps(result, default=to_json(args.get("mode"), args.get("nodoc")))

class Daemon(BaseHTTPRequestHandler):
    def do_POST(self):
        query = urlparse.urlparse(self.path).query
        args = urlparse.parse_qsl(query)

        length = int(self.headers.get("content-length", 0))
        source = self.rfile.read(length)

        self.send_response(200)
        self.end_headers()
        self.wfile.write(run(source, dict(args)).encode("utf8"))

    def log_message(self, format, *args):
        return # log silently

def to_json(mode, nodoc):
    include_pos = mode == "goto_definitions"
    def to_json(c):
        if c.type == "function":
            try:
                paramList = { p.description for p in c.params }
                params = ", ".join([p for p in paramList if p != None and p != "self"])
            except:
                params = ""
        return remove_nulls({
            "name": c.name + ("(" + params + ")" if c.type == "function" else ""),
            "replaceText": c.name + "(^^)" if c.type == "function" else None,
            "row": c.line if c.line and include_pos else None,
            "column": c.column if c.column and include_pos else None,
            "path": "/" + c.module_path if c.module_path and include_pos else None,
            "doc": abbrev(c.docstring()) if c.type != "module" # module docs dont work
                                         and c.name[-2:] != "__" # skim on bandwidth
                                         and not nodoc
                                         else None,
            "icon": {
                "function": "method",
                "module": "package",
                "class": "property",
            }.get(c.type, None),
        })
    return to_json

def remove_nulls(d):
    # iterate over list copy to avoid size change in Python 3
    # http://stackoverflow.com/a/11941855/1797347
    for key, value in list(d.items()):
        if value is None:
            del d[key]
        elif isinstance(value, dict):
            remove_nulls(value)
    return d

def abbrev(s):
    return s if len(s) < 2500 else s[:2500] + "..."

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run jedi functions as a daemon or via stdin")
    parser.add_argument("mode", help="Mode of operation", choices=["daemon", "completions", "goto_definitions", "goto_assignments"])
    parser.add_argument("--row", type=int, help="The row to read from")
    parser.add_argument("--column", type=int, help="The column to read from")
    parser.add_argument("--path", help="The path of the script")
    parser.add_argument("--port", type=int, help="The port for the daemon to listen on")
    parser.add_argument("--nodoc", help="Don't include docstrings in output")
    args = parser.parse_args()
    main(args)
