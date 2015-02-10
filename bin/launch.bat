:: Do not use "echo off" to not affect any child calls.
@setlocal

::——————————————————— fix ctrl c ———————————————————
@set allargs=
@if ("%initialized%")==("1") (
    @if "%~1"=="-fix_ctrl_c" (
        @call:rest %* allargs
    ) else (
        @call <nul %0 "-fix_ctrl_c" %*
        @goto :eof
    )
)
::——————————————————————————————————————————————————

:start

:: check if started from bin folder
@if not exist plugins (
    @cd ..
)

@if exist server.cloud9.js (
    @set fname="server.cloud9.js"
) else (
    @set fname="server.js"
)

@if ("%initialized%")==("1") (
    @call cmd /c node %fname% %allargs%
    @goto eof
)

:: add git to path
@set c9GitPath=
@call:where git c9GitPath
@if "x!c9GitPath!"=="x" (
    @echo missing git directory      rem todo: better message
    @goto eof
)
:: @echo %c9GitPath%
@CALL :resolve "%c9GitPath%\..\..\bin" c9GitPath

@set PATH=%c9GitPath%;%PATH%


@if not exist "%HOME%" @set HOME=%HOMEDRIVE%%HOMEPATH%
@if not exist "%HOME%" @set HOME=%USERPROFILE%
@set initialized=1



@cmd /K node %fname% %allargs%
@goto eof
:end

::—————————————————————————————————————————————————————————
::—— Functions http://www.dostips.com/                   ——
::—————————————————————————————————————————————————————————

:where
@SETLOCAL enableextensions enabledelayedexpansion
@set result=
@goto :wherestart
:: Function to find and print a file in the path.
:find_it
    @for %%i in (%1) do @set fullspec=%%~$PATH:i
    @if not "x!fullspec!"=="x" @set result=!fullspec!
@goto :eof

:wherestart

:: First try the unadorned filenmame.

@set fullspec=
@call :find_it

:: Then try all adorned filenames in order.

@set mypathext=!pathext!
:loop1
    :: Stop if found or out of extensions.

    @if "x!mypathext!"=="x" goto :loop1end

    :: Get the next extension and try it.

    @for /f "delims=;" %%j in ("!mypathext!") do @set myext=%%j
    @call :find_it %1!myext!

:: Remove the extension (not overly efficient but it works).

:loop2
    @if not "x!myext!"=="x" (
        @set myext=!myext:~1!
        @set mypathext=!mypathext:~1!
        @goto :loop2
    )
    @if not "x!mypathext!"=="x" set mypathext=!mypathext:~1!

    @goto :loop1
:loop1end

:: 
@ENDLOCAL&@set %~2=%result%
:endwhere
@goto :eof


:resolve
    @set %2=%~f1
    @goto :eof


:rest
:: array outResult
@SETLOCAL enableextensions enabledelayedexpansion
@set result=
@shift
:rest-loop1
@if not "%2"=="" (
    @set result=%result% %1
    @shift
)
:: 
@ENDLOCAL&@set %~2=%result%
:rest-end
@goto :eof




:eof