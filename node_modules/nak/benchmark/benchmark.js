var execSync = require('exec-sync');
var path = require("path");

var dir = "../"; // my development directory, ~133,523 files

var ag = function(filelist) {
    try {
    if (filelist) //--nocolor -p /Users/gjtorikian/Developer/cloud9/plugins-server/cloud9.ide.search/.agignore -U -l --search-binary [^\0] /Users/gjtorikian/Developer/cloud9infra
        execSync("cd .. && ag --nocolor -p ./.nakignore -U -l --search-binary -m 1 [^\\0] " + dir);
    else
      execSync("cd .. && ag --nocolor -p ./.nakignore -U -i -Q va " + dir);
    } catch (e) {}
} 

var nak = function(filelist) {
    if (filelist)
      execSync("cd .. && node bin/nak -l -a ./.nakignore " + dir);
    else
      execSync("cd .. && node bin/nak -a ./.nakignore -w va " + dir);
}

var ack = function(filelist) {
    if (filelist)
      execSync("cd .. && ack --nocolor -f -a --binary " + dir);
    else
      execSync("cd .. && ack --nocolor -a -i -w va " + dir);
}

var GNU = function(filelist) {
    if (filelist)
      execSync("cd .. && find " + dir + " -type f \\( ! -regex .*\\/\\.gz$ \\) \\( ! -regex .*\\/\\.bzr$ \\) \\( ! -regex .*\\/\\.cdv$ \\) \\( ! -regex .*\\/\\.dep$ \\) \\( ! -regex .*\\/\\.dot$ \\) \\( ! -regex .*\\/\\.nib$ \\) \\( ! -regex .*\\/\\.plst$ \\) \\( ! -regex .*\\/_darcs$ \\) \\( ! -regex .*\\/_sgbak$ \\) \\( ! -regex .*\\/autom4te\\.cache$ \\) \\( ! -regex .*\\/cover_db$ \\) \\( ! -regex .*\\/_build$ \\) \\( ! -regex .*\\/\\.tmp$ \\) \\( ! -regex .*\\/\\.architect\\/.* \\) \\( ! -regex .*\\/\\.sourcemint\\/.* \\) \\( ! -regex .*\\/\\.hg\\/.* \\) \\( ! -regex .*\\/\\.pc\\/.* \\) \\( ! -regex .*\\/\\.svn\\/.* \\) \\( ! -regex .*\\/blib\\/.* \\) \\( ! -regex .*\\/CVS\\/.* \\) \\( ! -regex .*\\/RCS\\/.* \\) \\( ! -regex .*\\/SCCS\\/.* \\) \\( ! -regex .*\\/\\.DS_Store\\/.* \\) \\( ! -regex .*/.git.* \\) \\( ! -regex .*/.c9revisions.* \\)");
    else
      execSync("cd .. && grep -s -r --color=never --binary-files=without-match -n -i  --exclude=*{.bzr,.cdv,~.dep,~.dot,~.nib,~.plst,.git,.hg,.pc,.svn,_MTN,blib,CVS,RCS,SCCS,_darcs,_sgbak,autom4te.cache,cover_db,_build}* --include=*{as,mxml,ada,adb,ads,asm,s,bat,cmd,c,h,xs,cfc,cfm,cfml,clj,cpp,cc,cxx,m,hpp,hh,hxx,cs,css,less,scss,sass,coffee,el,erl,hrl,f,f77,f90,f95,f03,for,ftn,fpp,hs,lhs,htm,html,shtml,xhtml,jade,java,properties,groovy,js,json,latex,ltx,jsp,jspx,jhtm,jhtml,lisp,lsp,lua,makefile,Makefile,mas,mhtml,mpl,mtxt,md,markdown,mm,ml,mli,pir,pasm,pmc,ops,pod,pg,tg,pl,pm,t,php,phpt,php3,php4,php5,phtml,pt,cpt,metadata,cpy,py,ps1,rakefile,rb,ru,rhtml,rjs,rxml,erb,rake,gemspec,scala,scm,ss,sh,bash,csh,tcsh,ksh,zsh,st,sql,ctl,tcl,itcl,itk,tex,cls,sty,txt,textile,tt,tt2,ttml,bas,frm,vb,resx,vim,yaml,yml,xml,dtd,xslt,ent,rdf,rss,svg,wsdl,atom,mathml,mml} 'va' " + dir);
}

var bench = function(name, func, filelist) {
  var start = Date.now(),
      times = 1;

  while (times--) {
    func(filelist);
  }

  var time = Date.now() - start;
  console.log('%s completed in %dms (%ds).', name, time, time / 1000);
}

bench('ag-filelist', ag, true);
bench('nak-filelist', nak, true);
bench('ack-filelist', ack, true);
bench('find-filelist', GNU, true);

bench('ag-search', ag);
bench('nak-search', nak);
bench('ack-search', ack);
bench('find-search', GNU);